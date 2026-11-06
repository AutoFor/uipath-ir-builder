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
    // tools/ir/gen-coded.ts で IR（NTakeScreenshot_Image）から生成。手で直さず IR を直す
    public class NTakeScreenshot_Image : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String htmlPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uia-m2-form.html");
            UiPath.Core.Image img = default;
            // テスト用の HTML を書く
            system.WriteTextFile(text: "<!DOCTYPE html><html><head><meta charset='utf-8'><title>UIA Test Form</title></head><body><h1>UIA Test Form</h1><div id='result'>ready</div><input id='name' type='text' value=''><button id='greet' onclick=\"document.getElementById('result').textContent='Hello, ['+document.getElementById('name').value+']'\">Greet</button><button id='alertbtn' onclick=\"alert('Hello alert');document.getElementById('result').textContent='alerted'\">Alert</button><button id='confirmbtn' onclick=\"document.getElementById('result').textContent='confirm:'+confirm('Proceed?')\">Confirm</button><button id='promptbtn' onclick=\"document.getElementById('result').textContent='prompt:'+prompt('Name?')\">Prompt</button><input id='file' type='file' onchange=\"document.getElementById('result').textContent='file:'+this.files[0].name\"><input id='files' type='file' multiple onchange=\"document.getElementById('result').textContent='files:'+this.files.length\"></body></html>", file: LocalResource.FromPath(htmlPath));
            // UIA Test Form を開く
            // NApplicationCard は中に Coded API の無いアクティビティがあり、それだけをスコープの外に出せないので XAML 経由（coded/_xaml/NTakeScreenshot_Image_1.xaml）
            var __xaml3 = RunWorkflow("coded/_xaml/NTakeScreenshot_Image_1.xaml", new Dictionary<string, object> { ["htmlPath"] = htmlPath, ["img"] = img });
            img = (UiPath.Core.Image)__xaml3["img"];
            Log(message: "image ok=" + (!(img == null)).ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
