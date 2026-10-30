using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ExtractFiles_Min）から生成。手で直さず IR を直す
    public class ExtractFiles_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String txt = default;
            system.WriteTextFile(text: "extract me", file: LocalResource.FromPath("output\\ExtractFiles_Min.a.txt"));
            system.CompressZipFiles(resourcesToArchive: System.Linq.Enumerable.Select(new string[] { "output\\ExtractFiles_Min.a.txt" }, __p => (UiPath.Platform.ResourceHandling.IResource)LocalResource.FromPath(__p)), compressedFileName: "output\\ExtractFiles_Min.zip", password: null, compressionLevel: UiPath.Activities.System.Compression.Zip.ArchiveCompressionLevel.Normal, codePage: UiPath.Activities.System.Encode.CodePages.Default, overrideExistingFile: true);
            system.ExtractUnzipFiles(file: LocalResource.FromPath("output\\ExtractFiles_Min.zip"), destinationFolder: "output\\ExtractFiles_Min", extractToADedicatedFolder: true, password: null, codePage: UiPath.Activities.System.Encode.CodePages.Default);
            txt = system.ReadTextFile(file: LocalResource.FromPath("output\\ExtractFiles_Min\\ExtractFiles_Min\\ExtractFiles_Min.a.txt"));
            Log(message: txt, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
