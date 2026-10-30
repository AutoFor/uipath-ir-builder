using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（InvokeWorkflowFile_Callee）から生成。手で直さず IR を直す
    public class InvokeWorkflowFile_Callee : CodedWorkflow
    {
        [Workflow]
        public String Execute(String in_Name, Int32 in_Count)
        {
            String out_Message = default;
            Log(message: "callee: " + in_Name + " x" + in_Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            out_Message = "こんにちは、" + in_Name;
            return out_Message;
        }
    }
}
