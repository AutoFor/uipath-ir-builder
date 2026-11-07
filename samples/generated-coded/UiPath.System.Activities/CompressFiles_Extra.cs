using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CompressFiles_Extra）から生成。手で直さず IR を直す
    public class CompressFiles_Extra : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            ILocalResource src = default;
            IEnumerable<IResource> srcs = default;
            FileInfo zipInfo = default;
            src = system.CreateFile(name: "CompressFiles_Extra.a.txt", path: "output");
            srcs = new UiPath.Platform.ResourceHandling.IResource[] { src };
            // AES256 で圧縮
            // CompressFiles はこの形の Coded API が無い（Coded API なし（EncryptionAlgorithm: CompressZipFiles に暗号化方式の引数が無い））ので XAML 経由（coded/_activities/CompressFiles_009fa9.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CompressFiles_009fa9.xaml", new Dictionary<string, object> { ["in_AllowDuplicateContentNames"] = false, ["in_CompressedFileName"] = "output\\CompressFiles_Extra.zip", ["in_Password"] = "secret", ["in_ResourcesToArchive"] = srcs });
            zipInfo = (System.IO.FileInfo)__xaml1["out_CompressedFileInfo"];
            Log(message: Convert.ToString(zipInfo.Name), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString((zipInfo.Length > 0).ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
