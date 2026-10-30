using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（UploadStorageFile_Min）から生成。手で直さず IR を直す
    public class UploadStorageFile_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            system.UploadStorageFile(destination: null, fileResource: LocalResource.FromPath("C:\\Temp\\ir-upload.txt"), storageBucketName: "ir-bucket");
            Log(message: "アップロードした", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
