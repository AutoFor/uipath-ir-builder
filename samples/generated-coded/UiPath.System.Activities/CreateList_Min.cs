using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CreateList_Min）から生成。手で直さず IR を直す
    public class CreateList_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IList<String> made = default;
            made = new List<String>();
            Log(message: "count=" + made.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
