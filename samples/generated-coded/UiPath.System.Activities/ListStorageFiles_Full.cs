using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;
using UiPath.Core.Activities.Storage;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ListStorageFiles_Full）から生成。手で直さず IR を直す
    public class ListStorageFiles_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IEnumerable<StorageFileInfo> files = default;
            // ストレージの一覧
            files = system.ListStorageFiles(directory: "reports", storageBucketName: "ir-bucket", folderPath: "Shared", recursive: true, filter: "*.csv", timeoutMS: 30000);
            Log(message: "ファイル数: " + files.Count().ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
