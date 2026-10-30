using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CheckTrue_Full）から生成。手で直さず IR を直す
    public class CheckTrue_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ok = default;
            // 通るチェック
            var __check1 = 1 + 1 == 2;
            if (!__check1) throw new Exception("ここでは出ない");
            ok = __check1;
            Log(message: "チェックを通った", level: UiPath.CodedWorkflows.LogLevel.Info);
            try
            {
                // 落ちるチェック
                var __check2 = 1 + 1 == 3;
                if (!__check2) throw new Exception("値が違う");
            }
            catch (Exception ex)
            {
                Log(message: Convert.ToString(ex.Message), level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
