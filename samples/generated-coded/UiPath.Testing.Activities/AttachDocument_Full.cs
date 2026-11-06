using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（AttachDocument_Full）から生成。手で直さず IR を直す
    public class AttachDocument_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uta-attach.txt");
            // 添付するファイルを書く
            system.WriteTextFile(text: "attach", file: LocalResource.FromPath(path));
            // ファイルを添付
            testing.AttachDocument(filePath: path, tags: new string[] { "ir", "sample" });
            Log(message: "添付した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
