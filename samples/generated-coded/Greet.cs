using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Greet）から生成。手で直さず IR を直す
    public class Greet : CodedWorkflow
    {
        [Workflow]
        public String Execute(String in_Name)
        {
            String out_Message = default;
            // あいさつを組み立てる
            out_Message = "こんにちは、" + in_Name + " さん";
            return out_Message;
        }
    }
}
