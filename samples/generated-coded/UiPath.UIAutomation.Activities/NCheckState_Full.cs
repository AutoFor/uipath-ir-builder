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
    // tools/ir/gen-coded.ts で IR（NCheckState_Full）から生成。手で直さず IR を直す
    public class NCheckState_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String htmlPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uia-test-form.html");
            String result = default;
            Boolean found = default;
            // テスト用の HTML を書く
            system.WriteTextFile(text: "<!DOCTYPE html><html><head><meta charset='utf-8'><title>UIA Test Form</title></head><body><h1>UIA Test Form</h1><input id='name' type='text' value=''><button id='greet' onclick=\"document.getElementById('result').textContent='Hello, ['+document.getElementById('name').value+']'\">Greet</button><label><input id='agree' type='checkbox'>agree</label><div id='result'>ready</div></body></html>", file: LocalResource.FromPath(htmlPath));
            // UIA Test Form を開く
            using (var app1 = uiAutomation.Open(targetApp: new TargetAppModel { Url = new Uri(htmlPath).AbsoluteUri, BrowserType = UiPath.UIAutomationNext.Enums.NBrowserType.Edge, Selector = "<html app='msedge.exe' title='UIA Test Form' />" }, targetAppOptions: new TargetAppOptions { OpenMode = UiPath.UIAutomationNext.Enums.NAppOpenMode.Always, CloseMode = UiPath.UIAutomationNext.Enums.NAppCloseMode.Always }))
            {
                // 無い要素を確かめる（全部入り）
                var __state2 = app1.WaitState(target: new TargetAnchorableModel { PartialSelector = "<webctrl id='missing' tag='DIV' />", ScopeSelector = "<html app='msedge.exe' title='UIA Test Form' />", SearchSteps = UiPath.UIAutomationNext.Enums.TargetSearchSteps.Selector }, checkStateOptions: new CheckStateOptions { Mode = UiPath.UIAutomationNext.Enums.NCheckStateMode.WaitAppear, CheckVisibility = false, Timeout = 2, DelayBefore = 0.1, HealingAgentBehavior = UiPath.UIAutomationNext.Enums.NChildHealingAgentBehavior.Disabled });
                found = __state2;
                if (__state2)
                {
                    Log(message: "あるはずのない要素があった", level: UiPath.CodedWorkflows.LogLevel.Warn);
                }
                else
                {
                    Log(message: "missing は無い", level: UiPath.CodedWorkflows.LogLevel.Info);
                }
            }
            Log(message: "found=" + found.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
