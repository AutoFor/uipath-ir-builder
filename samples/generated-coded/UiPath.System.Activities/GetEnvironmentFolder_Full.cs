using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetEnvironmentFolder_Full）から生成。手で直さず IR を直す
    public class GetEnvironmentFolder_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String folder = default;
            // ローミングの場所
            folder = System.Environment.GetFolderPath(System.Environment.SpecialFolder.ApplicationData);
            Log(message: Convert.ToString(System.IO.Path.GetFileName(folder)), level: UiPath.CodedWorkflows.LogLevel.Info);
            // ローカルの場所
            folder = System.Environment.GetFolderPath(System.Environment.SpecialFolder.LocalApplicationData);
            Log(message: Convert.ToString(System.IO.Path.GetFileName(folder)), level: UiPath.CodedWorkflows.LogLevel.Info);
            // Program Files
            folder = System.Environment.GetFolderPath(System.Environment.SpecialFolder.ProgramFiles);
            Log(message: Convert.ToString(System.IO.Path.GetFileName(folder)), level: UiPath.CodedWorkflows.LogLevel.Info);
            // システム
            folder = System.Environment.GetFolderPath(System.Environment.SpecialFolder.System);
            Log(message: Convert.ToString(System.IO.Path.GetFileName(folder)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
