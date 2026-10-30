using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ReadStorageText_Full）から生成。手で直さず IR を直す
    public class ReadStorageText_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String text = default;
            // ストレージの文字を読む
            text = system.ReadStorageText(path: "ir/hello.txt", storageBucketName: "ir-bucket", folderPath: "Shared", encoding: "utf-8", timeoutMS: 30000);
            Log(message: "内容: " + text, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
