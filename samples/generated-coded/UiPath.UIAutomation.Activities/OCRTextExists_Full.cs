using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（OCRTextExists_Full）から生成。手で直さず IR を直す
    public class OCRTextExists_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String htmlPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uia-test-form.html");
            Boolean exists = default;
            Boolean missing = default;
            // テスト用の HTML を書く
            system.WriteTextFile(text: "<!DOCTYPE html><html><head><meta charset='utf-8'><title>UIA Test Form</title></head><body style='font-family:Arial'><h1>UIA Test Form</h1><input id='name' type='text' value=''><button id='greet' onclick='document.getElementById(\"result\").textContent=\"Hello, [\"+document.getElementById(\"name\").value+\"]\"'>Greet</button><label><input id='agree' type='checkbox'>agree</label><button id='hov' onmousemove='document.getElementById(\"result\").textContent=\"hov hover\"'>HoverMe</button><button id='hide' onclick='document.getElementById(\"box\").style.visibility=\"hidden\"'>Hide</button><button id='hidelater' onclick='setTimeout(function(){document.getElementById(\"box\").style.visibility=\"hidden\"},1500)'>HideLater</button><button id='show' onclick='setTimeout(function(){document.getElementById(\"box\").style.visibility=\"visible\"},1500)'>Show</button><div id='result'>ready</div><div id='box' onclick='document.getElementById(\"result\").textContent=\"box clicked\"' onmousemove='document.getElementById(\"result\").textContent=\"box hover\"' style='width:240px;height:140px;margin:20px;background:#e00000;border:20px solid #0000e0'></div><div id='ocr' onclick='document.getElementById(\"result\").textContent=\"ocr clicked\"' onmousemove='document.getElementById(\"result\").textContent=\"ocr hover\"' style='font:bold 72px Arial;margin:20px;display:inline-block'>HELLO42</div></body></html>", file: LocalResource.FromPath(htmlPath));
            // UIA Test Form を開く（Classic）
            // OpenBrowser はCoded API が無い（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ））ので XAML 経由（coded/_xaml/OCRTextExists_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/OCRTextExists_Full_1.xaml", new Dictionary<string, object> { ["htmlPath"] = htmlPath, ["exists"] = exists, ["missing"] = missing });
            exists = (Boolean)__xaml1["exists"];
            missing = (Boolean)__xaml1["missing"];
            Log(message: "結果: " + exists.ToString() + " " + missing.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
