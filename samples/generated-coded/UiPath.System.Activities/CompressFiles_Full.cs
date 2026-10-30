using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CompressFiles_Full）から生成。手で直さず IR を直す
    public class CompressFiles_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            ILocalResource zipRes = default;
            system.WriteTextFile(text: "aaa", file: LocalResource.FromPath("output\\CompressFiles_Full.a.txt"));
            // パスワード付きで圧縮
            zipRes = system.CompressZipFiles(resourcesToArchive: System.Linq.Enumerable.Select(new string[] { "output\\CompressFiles_Full.a.txt" }, __p => (UiPath.Platform.ResourceHandling.IResource)LocalResource.FromPath(__p)), compressedFileName: "output\\CompressFiles_Full.zip", password: "secret", compressionLevel: UiPath.Activities.System.Compression.Zip.ArchiveCompressionLevel.Maximum, codePage: UiPath.Activities.System.Encode.CodePages.UTF_8, overrideExistingFile: true);
            Log(message: Convert.ToString(System.IO.Path.GetFileName(zipRes.LocalPath)), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString((new System.IO.FileInfo(zipRes.LocalPath).Length > 0).ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
