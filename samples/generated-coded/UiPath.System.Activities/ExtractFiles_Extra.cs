using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ExtractFiles_Extra）から生成。手で直さず IR を直す
    public class ExtractFiles_Extra : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DirectoryInfo destInfo = default;
            system.WriteTextFile(text: "extract me", file: LocalResource.FromPath("output\\ExtractFiles_Extra.a.txt"));
            system.CompressZipFiles(resourcesToArchive: System.Linq.Enumerable.Select(new string[] { "output\\ExtractFiles_Extra.a.txt" }, __p => (UiPath.Platform.ResourceHandling.IResource)LocalResource.FromPath(__p)), compressedFileName: "output\\ExtractFiles_Extra.zip", password: null, compressionLevel: UiPath.Activities.System.Compression.Zip.ArchiveCompressionLevel.Normal, codePage: UiPath.Activities.System.Encode.CodePages.Default, overrideExistingFile: true);
            // 展開（Coded に無い設定）
            // ExtractFiles はこの形の Coded API が無い（Coded API なし（ConflictResolution: ExtractUnzipFiles に引数が無い））ので XAML 経由（coded/_xaml/ExtractFiles_Extra_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/ExtractFiles_Extra_1.xaml", new Dictionary<string, object> { ["destInfo"] = destInfo });
            destInfo = (DirectoryInfo)__xaml1["destInfo"];
            Log(message: Convert.ToString(System.IO.File.Exists(System.IO.Path.Combine(destInfo.FullName, "ExtractFiles_Extra.a.txt")).ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
