using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（MultipleAssign_Full）から生成。手で直さず IR を直す
    public class MultipleAssign_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 a = default;
            Int32 b = default;
            String s = default;
            // 上から順に代入
            a = 10;
            b = a * 2;
            a = b + 1;
            s = "完了";
            Log(message: s + ": a=" + a.ToString() + ", b=" + b.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
