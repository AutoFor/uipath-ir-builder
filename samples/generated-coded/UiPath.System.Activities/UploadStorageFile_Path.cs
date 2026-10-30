using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（UploadStorageFile_Path）から生成。手で直さず IR を直す
    public class UploadStorageFile_Path : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // パス指定でアップロード
            system.UploadStorageFile(destination: "reports/" + "ir-upload.txt", fileResource: LocalResource.FromPath("C:\\Temp\\ir-upload.txt"), storageBucketName: "ir-bucket", folderPath: "Shared", timeoutMS: 30000);
            Log(message: "アップロードした", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
