using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（DownloadStorageFile_Min）から生成。手で直さず IR を直す
    public class DownloadStorageFile_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            ILocalResource file = default;
            file = system.DownloadStorageFile(path: "ir/report.txt", storageBucketName: "ir-bucket");
            Log(message: "ダウンロードした: " + file.LocalPath, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
