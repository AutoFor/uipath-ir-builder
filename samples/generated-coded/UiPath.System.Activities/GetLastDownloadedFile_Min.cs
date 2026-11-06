using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetLastDownloadedFile_Min）から生成。手で直さず IR を直す
    public class GetLastDownloadedFile_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            FileInfo f = default;
            system.CreateFolder(path: "output\\GetLastDownloadedFile_Min");
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\GetLastDownloadedFile_Min\\dl.txt"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            // GetLastDownloadedFile はCoded API が無い（Coded API なし（ISystemService に Get Last Downloaded File 相当が無い。Body の中で起きたダウンロードを待つ ActivityAction 型））ので XAML 経由（coded/_xaml/GetLastDownloadedFile_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/GetLastDownloadedFile_Min_1.xaml", new Dictionary<string, object> { ["f"] = f });
            f = (FileInfo)__xaml1["f"];
            Log(message: Convert.ToString(f.Name), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
