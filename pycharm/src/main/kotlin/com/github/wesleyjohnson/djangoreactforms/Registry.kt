package com.github.wesleyjohnson.djangoreactforms

import com.intellij.lang.ecmascript6.psi.ES6ExportDefaultAssignment
import com.intellij.lang.ecmascript6.psi.ES6ImportedBinding
import com.intellij.lang.javascript.psi.JSCallExpression
import com.intellij.lang.javascript.psi.JSExpression
import com.intellij.lang.javascript.psi.JSForInStatement
import com.intellij.lang.javascript.psi.JSLiteralExpression
import com.intellij.lang.javascript.psi.JSObjectLiteralExpression
import com.intellij.lang.javascript.psi.JSReferenceExpression
import com.intellij.lang.javascript.psi.JSVariable
import com.intellij.openapi.project.Project
import com.intellij.psi.PsiElement
import com.intellij.psi.search.GlobalSearchScope
import com.intellij.psi.search.PsiSearchHelper
import com.intellij.psi.util.CachedValueProvider
import com.intellij.psi.util.CachedValuesManager
import com.intellij.psi.util.PsiModificationTracker
import com.intellij.psi.util.PsiTreeUtil

/** The django-react-forms functions that register something under a key. */
val REGISTER_FUNCTIONS = setOf("registerComponent", "registerWidget")

/**
 * Every registry key in the project, mapped to the expression registered under it. Found in two
 * shapes, anywhere in the project's JS/TS (libraries such as node_modules are not searched):
 *
 *     registerWidget('AudiencePicker', AudiencePicker);
 *
 *     const components = { DataTable, 'classes.ClassMatrix': ClassMatrix };
 *     for (const [name, component] of Object.entries(components)) registerComponent(name, component);
 */
fun registryEntries(project: Project): Map<String, JSExpression> =
    CachedValuesManager.getManager(project).getCachedValue(project) {
        CachedValueProvider.Result.create(findEntries(project), PsiModificationTracker.MODIFICATION_COUNT)
    }

private fun findEntries(project: Project): Map<String, JSExpression> {
    val entries = linkedMapOf<String, JSExpression>()
    val scope = GlobalSearchScope.projectScope(project)
    for (function in REGISTER_FUNCTIONS) {
        PsiSearchHelper.getInstance(project).processAllFilesWithWord(function, scope, { file ->
            PsiTreeUtil.findChildrenOfType(file, JSCallExpression::class.java)
                .filter { (it.methodExpression as? JSReferenceExpression)?.referenceName == function }
                .forEach { call -> addEntries(call, entries) }
            true
        }, true)
    }
    return entries
}

private fun addEntries(call: JSCallExpression, entries: MutableMap<String, JSExpression>) {
    val args = call.arguments
    val key = args.getOrNull(0) ?: return
    val value = args.getOrNull(1) ?: return
    val literalKey = (key as? JSLiteralExpression)?.stringValue
    if (literalKey != null) {
        entries.putIfAbsent(literalKey, value)
        return
    }
    // A key that isn't a string: registered in a loop over Object.entries(someObject)
    val loop = PsiTreeUtil.getParentOfType(call, JSForInStatement::class.java) ?: return
    val entriesCall = loop.collectionExpression as? JSCallExpression ?: return
    if ((entriesCall.methodExpression as? JSReferenceExpression)?.referenceName != "entries") return
    val registry = objectLiteral(entriesCall.arguments.firstOrNull()) ?: return
    for (property in registry.properties) {
        val name = property.name ?: continue
        val propertyValue = property.value ?: continue
        entries.putIfAbsent(name, propertyValue)
    }
}

/** The object literal an expression names, following a variable and an import to it. */
private fun objectLiteral(expression: JSExpression?): JSObjectLiteralExpression? {
    if (expression is JSObjectLiteralExpression) return expression
    var target = (expression as? JSReferenceExpression)?.resolve() ?: return null
    if (target is ES6ImportedBinding) target = target.findReferencedElements().firstOrNull() ?: return null
    return (target as? JSVariable)?.initializer as? JSObjectLiteralExpression
}

/** The component registered under `key`: its function or class where possible, else the registration. */
fun resolveRegistryKey(project: Project, key: String): PsiElement? {
    val value = registryEntries(project)[key] ?: return null
    if (!value.isValid) return null
    // `X`, `X as never` and `withBoundary(X)` all name a component through a reference
    val reference = value as? JSReferenceExpression
        ?: PsiTreeUtil.findChildOfType(value, JSReferenceExpression::class.java)
        ?: return value
    val binding = reference.resolve() ?: return value
    // Follow the import to the component itself; fall back to the import line.
    val exported = (binding as? ES6ImportedBinding)?.findReferencedElements()?.firstOrNull()
        ?: return binding
    return unwrapDefaultExport(exported) ?: exported
}

// `export default function X() {}` -> X; `export default X;` -> wherever X is declared.
private fun unwrapDefaultExport(element: PsiElement): PsiElement? {
    if (element !is ES6ExportDefaultAssignment) return null
    return element.namedElement ?: (element.expression as? JSReferenceExpression)?.resolve()
}
