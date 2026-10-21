package com.github.wesleyjohnson.djangoreactforms

import com.intellij.lang.javascript.psi.JSFunction
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiNamedElement
import com.intellij.testFramework.fixtures.BasePlatformTestCase

class ComponentKeyTest : BasePlatformTestCase() {
    override fun setUp() {
        super.setUp()
        myFixture.addFileToProject(
            "frontend/class-matrix.tsx",
            "export default function ClassMatrix() { return null; }",
        )
        myFixture.addFileToProject(
            "frontend/quick-actions.tsx",
            "function QuickActions() { return null; }\nexport default QuickActions;",
        )
        myFixture.addFileToProject(
            "frontend/audience-picker.tsx",
            "export default function AudiencePicker() { return null; }",
        )
        myFixture.addFileToProject(
            "frontend/widgets.tsx",
            "export function TextInput() { return null; }\nexport const widgets = { TextInput };",
        )
        // A map registered in a loop, as HSA's index.ts does, wrapped in another call
        myFixture.addFileToProject(
            "frontend/index.ts",
            """
            import ClassMatrix from './class-matrix';
            import QuickActions from './quick-actions';
            declare function registerComponent(name: string, c: unknown): void;
            declare function guard(c: unknown): unknown;
            const components = { QuickActions, 'classes.ClassMatrix': ClassMatrix };
            for (const [name, component] of Object.entries(components)) {
                registerComponent(name, guard(component));
            }
            """.trimIndent(),
        )
        // Direct calls, and a loop over an imported map, in a file with any name
        myFixture.addFileToProject(
            "frontend/forms/anything.ts",
            """
            import AudiencePicker from '../audience-picker';
            import { widgets } from '../widgets';
            declare function registerWidget(name: string, c: unknown): void;
            for (const [name, component] of Object.entries(widgets)) {
                registerWidget(name, component);
            }
            registerWidget('AudiencePicker', AudiencePicker as never);
            """.trimIndent(),
        )
    }

    private fun assertResolvesTo(name: String, target: PsiElement?) {
        assertTrue("resolved to $target", target is JSFunction)
        assertEquals(name, (target as PsiNamedElement).name)
    }

    private fun pythonTarget(source: String): PsiElement? {
        myFixture.configureByText("components.py", source)
        return myFixture.getReferenceAtCaretPositionWithAssertion().resolve()
    }

    private fun templateTargets(template: String): List<PsiElement> {
        myFixture.configureByText("page.html", template)
        val offset = myFixture.caretOffset
        return ReactComponentTagGotoDeclarationHandler()
            .getGotoDeclarationTargets(myFixture.file.findElementAt(offset), offset, myFixture.editor)
            ?.toList().orEmpty()
    }

    fun testClassAttributeResolvesThroughALoopedMap() {
        assertResolvesTo("ClassMatrix", pythonTarget("class T:\n    component = 'classes.Class<caret>Matrix'\n"))
    }

    fun testShorthandKeyAndSeparateDefaultExport() {
        assertResolvesTo("QuickActions", pythonTarget("class T:\n    component = 'Quick<caret>Actions'\n"))
    }

    fun testKeywordArgumentResolvesThroughADirectCall() {
        assertResolvesTo(
            "AudiencePicker",
            pythonTarget("class W:\n    def __init__(self):\n        super().__init__(component='Audience<caret>Picker')\n"),
        )
    }

    fun testALoopOverAnImportedMap() {
        assertResolvesTo("TextInput", pythonTarget("class T:\n    component = 'Text<caret>Input'\n"))
    }

    fun testOtherStringsAreNotReferences() {
        myFixture.configureByText("x.py", "name = 'Quick<caret>Actions'\n")
        assertNull(myFixture.getReferenceAtCaretPosition())
    }

    fun testCompletionOffersEveryRegisteredKey() {
        myFixture.configureByText("t.py", "class T:\n    component = '<caret>'\n")
        myFixture.completeBasic()
        assertContainsElements(
            myFixture.lookupElementStrings!!,
            "classes.ClassMatrix", "QuickActions", "AudiencePicker", "TextInput",
        )
    }

    fun testTemplateTagResolves() {
        val targets = templateTargets("<div>{% react_component \"classes.Class<caret>Matrix\" semester=semester %}</div>")
        assertEquals(listOf("ClassMatrix"), targets.map { (it as PsiNamedElement).name })
    }

    fun testTemplateTagSingleQuotesAndEdgesOfKey() {
        assertEquals(1, templateTargets("{% react_component '<caret>QuickActions' %}").size)
        assertEquals(1, templateTargets("{% react_component 'QuickActions<caret>' props %}").size)
    }

    fun testTemplateTagIgnoresEverythingElse() {
        assertEmpty(templateTargets("{% react_component \"QuickActions\" la<caret>bel=\"x\" %}"))
        assertEmpty(templateTargets("{% react_component block.compo<caret>nent_name block.props %}"))
        assertEmpty(templateTargets("{% include \"Quick<caret>Actions\" %}"))
        assertEmpty(templateTargets("{% react_render component=\"Quick<caret>Actions\" %}"))
    }
}
