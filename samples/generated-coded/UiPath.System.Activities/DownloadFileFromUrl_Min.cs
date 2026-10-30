using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（DownloadFileFromUrl_Min）から生成。手で直さず IR を直す
    public class DownloadFileFromUrl_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            ILocalResource res = default;
            res = system.DownloadFileFromURLAsync("https://example.com/", fileName: null, conflictResolution: UiPath.Activities.System.FileOperations.FileConflictBehavior.Rename, timeout: 600, userAgentHeaderValue: null).GetAwaiter().GetResult();
            Log(message: Convert.ToString(System.IO.File.Exists(res.LocalPath).ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
