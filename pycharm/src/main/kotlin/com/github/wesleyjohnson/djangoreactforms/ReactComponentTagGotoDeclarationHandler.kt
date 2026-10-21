package com.github.wesleyjohnson.djangoreactforms

import com.intellij.codeInsight.navigation.actions.GotoDeclarationHandler
import com.intellij.openapi.editor.Editor
import com.intellij.psi.PsiElement

/** `{% react_component "Badge" ... %}`: group 2 is the key. */
private val REACT_COMPONENT_TAG = Regex("""\{%\s*react_component\s+(["'])([^"'\s]+)\1""")

/** How far either side of the caret to look for the enclosing `{% ... %}`. */
private const val TAG_WINDOW = 2000

/**
 * Cmd/Ctrl+click the key in a template's `{% react_component "..." %}` to open the component.
 *
 * Works on the text around the caret instead of Django template PSI, so it needs neither the
 * Django plugin nor a Pro license. A variable name (`{% react_component block.name %}`) is skipped.
 */
class ReactComponentTagGotoDeclarationHandler : GotoDeclarationHandler {
    override fun getGotoDeclarationTargets(
        sourceElement: PsiElement?,
        offset: Int,
        editor: Editor,
    ): Array<PsiElement>? {
        val project = editor.project ?: return null
        val text = editor.document.charsSequence
        val start = maxOf(0, offset - TAG_WINDOW)
        val end = minOf(text.length, offset + TAG_WINDOW)
        val key = REACT_COMPONENT_TAG.findAll(text.subSequence(start, end))
            .mapNotNull { it.groups[2] }
            .firstOrNull { offset - start in it.range.first..it.range.last + 1 }
            ?: return null
        return resolveRegistryKey(project, key.value)?.let { arrayOf(it) }
    }
}
