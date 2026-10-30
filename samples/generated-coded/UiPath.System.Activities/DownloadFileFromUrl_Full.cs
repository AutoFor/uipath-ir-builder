using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（DownloadFileFromUrl_Full）から生成。手で直さず IR を直す
    public class DownloadFileFromUrl_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            ILocalResource res = default;
            // example.com を保存
            res = system.DownloadFileFromURLAsync("https://example.com/", fileName: "output\\DownloadFileFromUrl_Full.html", conflictResolution: UiPath.Activities.System.FileOperations.FileConflictBehavior.Replace, timeout: 60, userAgentHeaderValue: "ir-builder-test").GetAwaiter().GetResult();
            Log(message: Convert.ToString(System.IO.Path.GetFileName(res.LocalPath)), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString((new System.IO.FileInfo(res.LocalPath).Length > 0).ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
