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
    // tools/ir/gen-coded.ts で IR（NUnblockUserInput_Full）から生成。手で直さず IR を直す
    public class NUnblockUserInput_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // 入力のブロックを解除する（全部入り）
            uiAutomation.UnblockUserInput();
        }
    }
}
