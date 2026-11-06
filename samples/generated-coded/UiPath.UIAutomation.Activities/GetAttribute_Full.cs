using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetAttribute_Full）から生成。手で直さず IR を直す
    public class GetAttribute_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String htmlPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uia-test-form.html");
            String page2Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uia-test-page2.html");
            String result = default;
            // テスト用の HTML を書く
            system.WriteTextFile(text: "<!DOCTYPE html><html><head><meta charset='utf-8'><title>UIA Test Form</title></head><body><h1>UIA Test Form</h1><input id='name' type='text' value=''><button id='greet' onclick=\"document.getElementById('result').textContent='Hello, ['+document.getElementById('name').value+']'\">Greet</button><label><input id='agree' type='checkbox' onchange=\"document.getElementById('result').textContent='agree:'+this.checked\">agree</label><select id='color' onchange=\"document.getElementById('result').textContent='color:'+this.value\"><option>Red</option><option>Green</option><option>Blue</option></select><select id='multi' multiple size='3' onchange=\"document.getElementById('result').textContent='multi:'+Array.from(this.selectedOptions).map(function(o){return o.text}).join(',')\"><option>Apple</option><option>Banana</option><option>Cherry</option></select><span id='note' title='tip-abc'>visible note</span><div id='hidden' style='display:none'>secret</div><div id='result'>ready</div></body></html>", file: LocalResource.FromPath(htmlPath));
            // UIA Test Form を開く（Classic）
            // OpenBrowser はCoded API が無い（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ））ので XAML 経由（coded/_xaml/GetAttribute_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/GetAttribute_Full_1.xaml", new Dictionary<string, object> { ["htmlPath"] = htmlPath, ["result"] = result });
            result = (String)__xaml1["result"];
            Log(message: "結果: " + result, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
