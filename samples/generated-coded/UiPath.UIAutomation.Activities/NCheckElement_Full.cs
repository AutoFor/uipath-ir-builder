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
    // tools/ir/gen-coded.ts で IR（NCheckElement_Full）から生成。手で直さず IR を直す
    public class NCheckElement_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String htmlPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uia-test-form.html");
            String result = default;
            Boolean found = default;
            // テスト用の HTML を書く
            system.WriteTextFile(text: "<!DOCTYPE html><html><head><meta charset='utf-8'><title>UIA Test Form</title></head><body><h1>UIA Test Form</h1><div id='result'>ready</div><input id='name' type='text' value=''><button id='greet' onclick=\"document.getElementById('result').textContent='Hello, ['+document.getElementById('name').value+']'\">Greet</button><label><input id='agree' type='checkbox' onchange=\"document.getElementById('result').textContent='agree='+this.checked\">agree</label><select id='fruit' onchange=\"document.getElementById('result').textContent='fruit='+this.value\"><option>apple</option><option>banana</option><option>cherry</option></select><div id='hoverbox' style='border:1px solid;padding:6px;width:120px' onmouseover=\"document.getElementById('result').textContent='hovered'\">hover me</div><input id='focusme' type='text' onfocus=\"document.getElementById('result').textContent='focused'\"><input id='kbd' type='text' onkeydown=\"document.getElementById('result').textContent='key:'+event.key\"><div id='scrollbox' style='height:60px;width:200px;overflow:auto' onscroll=\"document.getElementById('result').textContent=(this.scrollTop>0?'scrolled':'top')\"><div style='height:400px'>scroll me</div><p id='scrollend'>end</p></div><div id='src' style='border:1px solid;padding:6px;width:80px;background:#cde' onmousedown=\"window.dragging=true\">drag me</div><div id='dst' style='border:1px solid;padding:6px;width:80px;background:#edc' onmouseup=\"if(window.dragging){document.getElementById('result').textContent='dropped'}\">drop here</div><ul id='fruits'><li>apple</li><li>banana</li><li>cherry</li></ul><table id='tbl'><tr><th>Name</th><th>Qty</th></tr><tr><td>apple</td><td>3</td></tr><tr><td>banana</td><td>5</td></tr><tr><td>cherry</td><td>7</td></tr></table><script>document.onmouseup=function(){setTimeout(function(){window.dragging=false},0)}</script></body></html>", file: LocalResource.FromPath(htmlPath));
            // UIA Test Form を開く
            // NApplicationCard は中に Coded API の無いアクティビティがあり、それだけをスコープの外に出せないので XAML 経由（coded/_xaml/NCheckElement_Full_1.xaml）
            var __xaml3 = RunWorkflow("coded/_xaml/NCheckElement_Full_1.xaml", new Dictionary<string, object> { ["htmlPath"] = htmlPath, ["found"] = found });
            found = (Boolean)__xaml3["found"];
            Log(message: "found=" + found.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
