using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（DownloadStorageFile_Full）から生成。手で直さず IR を直す
    public class DownloadStorageFile_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            ILocalResource file = default;
            // ストレージからダウンロード
            file = system.DownloadStorageFile(path: "ir/report.txt", storageBucketName: "ir-bucket", folderPath: "Shared", destination: "C:\\Temp\\ir-download\\report.txt", timeoutMS: 30000);
            Log(message: "ダウンロードした: " + file.LocalPath, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
