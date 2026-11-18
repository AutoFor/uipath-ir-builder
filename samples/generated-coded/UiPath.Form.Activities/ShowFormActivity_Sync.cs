using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ShowFormActivity_Sync）から生成。手で直さず IR を直す
    public class ShowFormActivity_Sync : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String name = default;
            Boolean agree = default;
            Nullable<Boolean> submitted = default;
            // フォームを出して閉じるまで待つ
            // ShowFormActivity は対応表が無いので XAML 経由（coded/_activities/ShowFormActivity_35b8cb.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/ShowFormActivity_35b8cb.xaml", new Dictionary<string, object> { ["in_Title"] = "入力してください", ["in_TopMost"] = true, ["io_Arguments_name"] = name });
            submitted = (System.Nullable<System.Boolean>)__xaml1["out_Result"];
            agree = (Boolean)__xaml1["out_Arguments_agree"];
            name = (String)__xaml1["io_Arguments_name"];
            Log(message: "入力: " + name + " 同意: " + agree.ToString() + " 結果: " + submitted.ToString());
        }
    }
}
