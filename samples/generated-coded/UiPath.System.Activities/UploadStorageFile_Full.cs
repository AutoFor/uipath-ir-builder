using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（UploadStorageFile_Full）から生成。手で直さず IR を直す
    public class UploadStorageFile_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute(ILocalResource in_File)
        {
            // ストレージへアップロード
            system.UploadStorageFile(destination: "reports/" + "ir-upload.txt", fileResource: in_File, storageBucketName: "ir-bucket", folderPath: "Shared", timeoutMS: 30000);
            Log(message: "アップロードした", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
