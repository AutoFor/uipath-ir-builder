using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ExtractData_Min）から生成。手で直さず IR を直す
    public class ExtractData_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String htmlPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uia-test-form.html");
            DataTable dt = new System.Data.DataTable();
            // テスト用の HTML を書く
            system.WriteTextFile(text: "<!DOCTYPE html><html><head><meta charset='utf-8'><title>UIA Test Form</title></head><body><h1>UIA Test Form</h1><input id='name' type='text' value=''><button id='greet' onclick=\"document.getElementById('result').textContent='Hello, ['+document.getElementById('name').value+']'\">Greet</button><label><input id='agree' type='checkbox'>agree</label><div id='result'>ready</div><table id='tbl'><tr><td>a1</td><td>b1</td></tr><tr><td>a2</td><td>b2</td></tr><tr><td>a3</td><td>b3</td></tr></table></body></html>", file: LocalResource.FromPath(htmlPath));
            // UIA Test Form を開く（Classic）
            // OpenBrowser はCoded API が無い（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ））ので XAML 経由（coded/_xaml/ExtractData_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/ExtractData_Min_1.xaml", new Dictionary<string, object> { ["htmlPath"] = htmlPath, ["dt"] = dt });
            dt = (DataTable)__xaml1["dt"];
            Log(message: "行数: " + dt.Rows.Count.ToString() + " 先頭: " + dt.Rows[0][0].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
