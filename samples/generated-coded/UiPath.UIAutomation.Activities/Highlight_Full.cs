using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Highlight_Full）から生成。手で直さず IR を直す
    public class Highlight_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String htmlPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uia-test-form.html");
            DateTime t0 = default;
            Double sec = default;
            // テスト用の HTML を書く
            system.WriteTextFile(text: "<!DOCTYPE html><html><head><meta charset='utf-8'><title>UIA Test Form</title></head><body><h1>UIA Test Form</h1><input id='name' type='text' value=''><button id='greet' onclick=\"document.getElementById('result').textContent='Hello, ['+document.getElementById('name').value+']'\">Greet</button><label><input id='agree' type='checkbox'>agree</label><div id='result'>ready</div></body></html>", file: LocalResource.FromPath(htmlPath));
            // UIA Test Form を開く（Classic）
            // OpenBrowser はCoded API が無い（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ））ので XAML 経由（coded/_xaml/Highlight_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/Highlight_Full_1.xaml", new Dictionary<string, object> { ["htmlPath"] = htmlPath, ["t0"] = t0, ["sec"] = sec });
            t0 = (DateTime)__xaml1["t0"];
            sec = (Double)__xaml1["sec"];
            Log(message: "3秒近くかかった: " + (sec >= 2.5).ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
