using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CommentOut_Full）から生成。手で直さず IR を直す
    public class CommentOut_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 n = default;
            // 無効にした処理
            // CommentOut（中のアクティビティは実行されない）
            Log(message: "n=" + n.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
