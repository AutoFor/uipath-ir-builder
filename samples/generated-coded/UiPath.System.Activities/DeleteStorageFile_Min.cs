using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（DeleteStorageFile_Min）から生成。手で直さず IR を直す
    public class DeleteStorageFile_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            system.DeleteStorageFile(path: "ir/delete-me.txt", storageBucketName: "ir-bucket");
            Log(message: "削除した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
