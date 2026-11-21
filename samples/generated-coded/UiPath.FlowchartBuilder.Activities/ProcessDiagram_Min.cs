using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ProcessDiagram_Min）から生成。手で直さず IR を直す
    public class ProcessDiagram_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // Long Running Workflow
            // ProcessDiagram は対応表が無いので XAML 経由（coded/_xaml/ProcessDiagram_Min_1.xaml）
            RunWorkflow("coded/_xaml/ProcessDiagram_Min_1.xaml", null);
        }
    }
}
