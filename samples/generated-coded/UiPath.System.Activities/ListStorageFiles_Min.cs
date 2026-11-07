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
    // tools/ir/gen-coded.ts で IR（ListStorageFiles_Min）から生成。手で直さず IR を直す
    public class ListStorageFiles_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IEnumerable<UiPath.Core.Activities.Storage.StorageFileInfo> files = default;
            files = system.ListStorageFiles(directory: "/", storageBucketName: "ir-bucket", folderPath: null, recursive: true, filter: null, timeoutMS: 30000);
            Log(message: "ファイル数: " + files.Count().ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
