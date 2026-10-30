using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CompressFiles_Min）から生成。手で直さず IR を直す
    public class CompressFiles_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ex = default;
            system.WriteTextFile(text: "aaa", file: LocalResource.FromPath("output\\CompressFiles_Min.a.txt"));
            system.WriteTextFile(text: "bbb", file: LocalResource.FromPath("output\\CompressFiles_Min.b.txt"));
            system.CompressZipFiles(resourcesToArchive: System.Linq.Enumerable.Select(new string[] { "output\\CompressFiles_Min.a.txt", "output\\CompressFiles_Min.b.txt" }, __p => (UiPath.Platform.ResourceHandling.IResource)LocalResource.FromPath(__p)), compressedFileName: "output\\CompressFiles_Min.zip", password: null, compressionLevel: UiPath.Activities.System.Compression.Zip.ArchiveCompressionLevel.Normal, codePage: UiPath.Activities.System.Encode.CodePages.Default, overrideExistingFile: true);
            ex = system.PathExists(path: "output\\CompressFiles_Min.zip", pathType: UiPath.Core.Activities.PathType.File);
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
