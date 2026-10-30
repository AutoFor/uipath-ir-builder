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
    // tools/ir/gen-coded.ts で IR（NBlockUserInput_Min）から生成。手で直さず IR を直す
    public class NBlockUserInput_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // 入力をブロックして処理する
            using (var block1 = uiAutomation.BlockUserInput(blockUserInputOptions: new BlockUserInputOptions()))
            {
                Log(message: "blocked", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
