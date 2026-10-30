using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CheckFalse_Min）から生成。手で直さず IR を直す
    public class CheckFalse_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            try
            {
                var __check1 = 1 + 1 == 3;
                if (__check1) throw new Exception("");
                Log(message: "チェックを通った", level: UiPath.CodedWorkflows.LogLevel.Info);
                var __check2 = 1 + 1 == 2;
                if (__check2) throw new Exception("");
                Log(message: "ここには来ない", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
            catch (Exception ex)
            {
                Log(message: "例外が出た", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
