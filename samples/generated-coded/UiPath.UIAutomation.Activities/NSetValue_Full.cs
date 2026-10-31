using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;
using UiPath.UIAutomationNext.API.Models;
using UiPath.UIAutomationNext.Enums;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（NSetValue_Full）から生成。手で直さず IR を直す
    public class NSetValue_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String htmlPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uia-test-form.html");
            // テスト用の HTML を書く
            system.WriteTextFile(text: "<!DOCTYPE html><html><head><meta charset='utf-8'><title>UIA Test Form</title></head><body><h1>UIA Test Form</h1><input id='name' type='text' value=''><button id='greet' onclick=\"document.getElementById('result').textContent='Hello, ['+document.getElementById('name').value+']'\">Greet</button><label><input id='agree' type='checkbox'>agree</label><div id='result'>ready</div></body></html>", file: LocalResource.FromPath(htmlPath));
            // UIA Test Form を開く
            using (var app1 = uiAutomation.Open(targetApp: new TargetAppModel { Url = new Uri(htmlPath).AbsoluteUri, BrowserType = UiPath.UIAutomationNext.Enums.NBrowserType.Edge, Selector = "<html app='msedge.exe' title='UIA Test Form' />" }, targetAppOptions: new TargetAppOptions { AttachMode = UiPath.UIAutomationNext.Enums.NAppAttachMode.ByInstance, OpenMode = UiPath.UIAutomationNext.Enums.NAppOpenMode.Always, CloseMode = UiPath.UIAutomationNext.Enums.NAppCloseMode.Always, HealingAgentBehavior = UiPath.UIAutomationNext.Enums.NChildHealingAgentBehavior.Job }))
            {
                // NSetValue（full）
                app1.SetValue(target: new TargetAnchorableModel { ScopeSelector = "<html app='msedge.exe' title='UIA Test Form' />", SearchSteps = UiPath.UIAutomationNext.Enums.TargetSearchSteps.SemanticSelector, TargetType = UiPath.UIAutomationNext.Enums.TargetType.SemanticBased, SemanticSelector = "名前の入力欄", SemanticSelectorFindMethod = UiPath.UIAutomationNext.Enums.NSemanticSelectorFindMethod.Dom, SemanticElementType = UiPath.UIAutomationNext.Enums.NSemanticElementType.InputBox }, setValueOptions: new SetValueOptions { Value = "Hanako", EnableValidation = true, Timeout = 60, DelayBefore = 0.1, DelayAfter = 0.1, ContinueOnError = false, HealingAgentBehavior = UiPath.UIAutomationNext.Enums.NChildHealingAgentBehavior.Disabled });
            }
        }
    }
}
