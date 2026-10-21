package com.github.wesleyjohnson.djangoreactforms

import com.intellij.patterns.PlatformPatterns.psiElement
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiReference
import com.intellij.psi.PsiReferenceBase
import com.intellij.psi.PsiReferenceContributor
import com.intellij.psi.PsiReferenceProvider
import com.intellij.psi.PsiReferenceRegistrar
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.util.ProcessingContext
import com.jetbrains.python.psi.PyAssignmentStatement
import com.jetbrains.python.psi.PyClass
import com.jetbrains.python.psi.PyKeywordArgument
import com.jetbrains.python.psi.PyStringLiteralExpression
import com.jetbrains.python.psi.PyTargetExpression

/**
 * Links the two places a component key appears in Python:
 *
 *     class Dashboard(ReactRenderableMixin):
 *         component = 'Dashboard'
 *
 *     ReactComponentWidget(attrs, component='TagInput', props=props)
 */
class ComponentKeyReferenceContributor : PsiReferenceContributor() {
    override fun registerReferenceProviders(registrar: PsiReferenceRegistrar) {
        registrar.registerReferenceProvider(
            psiElement(PyStringLiteralExpression::class.java),
            object : PsiReferenceProvider() {
                override fun getReferencesByElement(
                    element: PsiElement,
                    context: ProcessingContext,
                ): Array<PsiReference> {
                    val literal = element as PyStringLiteralExpression
                    return if (isComponentKey(literal)) {
                        arrayOf(ComponentKeyReference(literal))
                    } else {
                        PsiReference.EMPTY_ARRAY
                    }
                }
            },
        )
    }

    private fun isComponentKey(literal: PyStringLiteralExpression): Boolean =
        when (val parent = literal.parent) {
            is PyKeywordArgument -> parent.keyword == "component"
            is PyAssignmentStatement -> {
                val target = parent.targets.singleOrNull() as? PyTargetExpression
                target?.name == "component" &&
                    PsiTreeUtil.getParentOfType(parent, PyClass::class.java) != null
            }
            else -> false
        }
}

class ComponentKeyReference(literal: PyStringLiteralExpression) :
    PsiReferenceBase<PyStringLiteralExpression>(literal, literal.stringValueTextRange) {

    override fun resolve(): PsiElement? = resolveRegistryKey(element.project, element.stringValue)

    // Completion inside component = '' offers every registered key.
    override fun getVariants(): Array<Any> = registryEntries(element.project).keys.toTypedArray()
}
