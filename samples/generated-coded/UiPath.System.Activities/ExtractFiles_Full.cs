using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ExtractFiles_Full）から生成。手で直さず IR を直す
    public class ExtractFiles_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            ILocalResource zipRes = default;
            ILocalResource[] files = default;
            String txt = default;
            system.WriteTextFile(text: "extract me", file: LocalResource.FromPath("output\\ExtractFiles_Full.a.txt"));
            zipRes = system.CompressZipFiles(resourcesToArchive: System.Linq.Enumerable.Select(new string[] { "output\\ExtractFiles_Full.a.txt" }, __p => (UiPath.Platform.ResourceHandling.IResource)LocalResource.FromPath(__p)), compressedFileName: "output\\ExtractFiles_Full.zip", password: "secret", compressionLevel: UiPath.Activities.System.Compression.Zip.ArchiveCompressionLevel.Normal, codePage: UiPath.Activities.System.Encode.CodePages.Default, overrideExistingFile: true);
            // パスワード付き zip を展開
            files = system.ExtractUnzipFiles(file: zipRes, destinationFolder: "output\\ExtractFiles_Full", extractToADedicatedFolder: false, password: "secret", codePage: UiPath.Activities.System.Encode.CodePages.UTF_8);
            Log(message: Convert.ToString(files.Length.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            txt = system.ReadTextFile(file: files[0]);
            Log(message: txt, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
