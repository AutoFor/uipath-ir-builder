using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Comment_Full）から生成。手で直さず IR を直す
    public class Comment_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // メモ
            // 1行目 2行目
            Log(message: "コメントの後", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
