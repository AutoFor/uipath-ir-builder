using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ChangeType_Full）から生成。手で直さず IR を直す
    public class ChangeType_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String numText = "7";
            Int32 n = default;
            String flagText = "True";
            Boolean flag = default;
            // 文字列を整数に
            n = (Int32)Convert.ChangeType(numText, typeof(Int32));
            Log(message: "整数+1: " + (n + 1).ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            // 文字列を真偽値に
            flag = (Boolean)Convert.ChangeType(flagText, typeof(Boolean));
            if (flag)
            {
                Log(message: "真偽値: True", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
            else
            {
                Log(message: "真偽値: False", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
