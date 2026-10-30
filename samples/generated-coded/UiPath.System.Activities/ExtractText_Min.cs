using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ExtractText_Min）から生成。手で直さず IR を直す
    public class ExtractText_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String first = default;
            {
                IEnumerable<string> __found;
                if (true) __found = system.ExtractTextOccurrences("ID: [123] end", "[", "]", false, false);
                else if (false) __found = system.ExtractEmails("ID: [123] end", false);
                else if (false) __found = system.ExtractUrls("ID: [123] end", false, false);
                else __found = new[] { system.ExtractTextFromHTML("ID: [123] end") };
                _ = __found;
                first = __found.FirstOrDefault();
            }
            Log(message: first, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
