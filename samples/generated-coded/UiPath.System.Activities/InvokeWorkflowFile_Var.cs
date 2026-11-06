using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（InvokeWorkflowFile_Var）から生成。手で直さず IR を直す
    public class InvokeWorkflowFile_Var : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Dictionary<String, Object> argDict = new Dictionary<String, Object>() { { "in_Name", "三郎" }, { "in_Count", 3 } };
            // 引数を辞書の変数で渡す
            // InvokeWorkflowFile はこの形の Coded API が無い（RunWorkflow の引数の辞書を実行時の変数で渡し、Out も同じ辞書へ書き戻す動きは、機械的に C# へ直していない）ので XAML 経由（coded/_xaml/InvokeWorkflowFile_Var_1.xaml）
            RunWorkflow("coded/_xaml/InvokeWorkflowFile_Var_1.xaml", new Dictionary<string, object> { ["argDict"] = argDict });
            Log(message: "辞書の戻り値: " + Convert.ToString(argDict["out_Message"]), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
