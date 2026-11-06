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
    // tools/ir/gen-coded.ts で IR（VerifyControlAttribute_Min）から生成。手で直さず IR を直す
    public class VerifyControlAttribute_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String htmlPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uia-test-form.html");
            String result = default;
            String txt = default;
            Boolean ok = default;
            // テスト用の HTML を書く
            system.WriteTextFile(text: "<!DOCTYPE html><html><head><meta charset='utf-8'><title>UIA Test Form</title></head><body><h1>UIA Test Form</h1><input id='name' type='text' value=''><button id='greet' onclick=\"document.getElementById('result').textContent='Hello, ['+document.getElementById('name').value+']'\">Greet</button><label><input id='agree' type='checkbox'>agree</label><div id='result'>ready</div></body></html>", file: LocalResource.FromPath(htmlPath));
            // UIA Test Form を開く
            // NApplicationCard は中に Coded API の無いアクティビティがあり、それだけをスコープの外に出せないので XAML 経由（coded/_xaml/VerifyControlAttribute_Min_1.xaml）
            var __xaml3 = RunWorkflow("coded/_xaml/VerifyControlAttribute_Min_1.xaml", new Dictionary<string, object> { ["htmlPath"] = htmlPath, ["ok"] = ok, ["txt"] = txt });
            ok = (Boolean)__xaml3["ok"];
            txt = (String)__xaml3["txt"];
            Log(message: Convert.ToString("結果: " + ok.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
