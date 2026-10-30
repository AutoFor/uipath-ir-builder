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
    // tools/ir/gen-coded.ts で IR（NBlockUserInput_Full）から生成。手で直さず IR を直す
    public class NBlockUserInput_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // 入力をブロックして処理する（全部入り）
            using (var block1 = uiAutomation.BlockUserInput(blockUserInputOptions: new BlockUserInputOptions { BlockType = UiPath.UIAutomationNext.Enums.NBlockInputType.Both, KeyModifiers = UiPath.UIAutomationNext.Enums.NKeyModifiers.Alt, Keys = "F10", Allow3rdPartyApps = false }))
            {
                Log(message: "blocked", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
