using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（BlockUserInput_Full）から生成。手で直さず IR を直す
    public class BlockUserInput_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // 入力をブロックする（全部入り）
            // BlockUserInput はCoded API が無い（Coded API なし（Classic の入力ブロック。Coded の uiAutomation.BlockUserInput は Modern（NBlockUserInput）のオプションで、Classic の Body を持つ形とは対応しない））ので XAML 経由（coded/_xaml/BlockUserInput_Full_1.xaml）
            RunWorkflow("coded/_xaml/BlockUserInput_Full_1.xaml", null);
        }
    }
}
