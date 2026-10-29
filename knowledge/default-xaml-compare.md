# get-default-xaml とカタログの突き合わせ

カタログ: UiPath.System.Activities 26.10.0 / UiPath.UIAutomation.Activities 26.10.6

| アクティビティ | default に出た | うちカタログに無い | enum 外の値 | default に出ない | うち out | うち必須 |
| --- | --- | --- | --- | --- | --- | --- |
| ForEach | 2 | 0 | 0 | 3 | 0 | 1 |
| InvokeWorkflowFile | 4 | 0 | 0 | 8 | 0 | 0 |
| LogMessage | 1 | 0 | 0 | 1 | 0 | 0 |
| MultipleAssign | 1 | 0 | 0 | 0 | 0 | 0 |
| NApplicationCard | 7 | 0 | 0 | 23 | 1 | 0 |
| NCheckState | 5 | 0 | 0 | 19 | 2 | 0 |
| NClick | 7 | 0 | 0 | 19 | 1 | 0 |
| NGetText | 3 | 0 | 0 | 18 | 4 | 0 |
| NTypeInto | 7 | 0 | 0 | 23 | 1 | 0 |
| ReadTextFile | 3 | 0 | 0 | 2 | 0 | 0 |
| RetryScope | 4 | 0 | 0 | 4 | 0 | 0 |
| WriteTextFile | 4 | 0 | 0 | 2 | 0 | 0 |

## ForEach

- default に出たもの: `Body={x:Null}`, `CurrentIndex={x:Null}`
- カタログに無いもの: なし
- default に出ない out/inout: なし
- default に出ない必須: `Values`

## InvokeWorkflowFile

- default に出たもの: `ArgumentsVariable={x:Null}`, `WorkflowFileName={x:Null}`, `UnSafe=False`, `Arguments=(要素)`
- カタログに無いもの: なし
- default に出ない out/inout: なし
- default に出ない必須: なし

## LogMessage

- default に出たもの: `Message={x:Null}`
- カタログに無いもの: なし
- default に出ない out/inout: なし
- default に出ない必須: なし

## MultipleAssign

- default に出たもの: `AssignOperations=(要素)`
- カタログに無いもの: なし
- default に出ない out/inout: なし
- default に出ない必須: なし

## NApplicationCard

- default に出たもの: `AttachMode=ByInstance`, `HealingAgentBehavior=Job`, `IsDisplayNameAuto=True`, `ScopeGuid=09b63a48-a2be-4408-8ca2-02d5950510b9`, `Version=V2`, `Body=(要素)`, `TargetApp=(要素)`
- カタログに無いもの: なし
- default に出ない out/inout: `OutUiElement`
- default に出ない必須: なし

## NCheckState

- default に出たもの: `DisplayName=アプリのステートを確認`, `HealingAgentBehavior=Disabled`, `Version=V5`, `IfExists=(要素)`, `IfNotExists=(要素)`
- カタログに無いもの: なし
- default に出ない out/inout: `Exists`, `OutUiElement`
- default に出ない必須: なし

## NClick

- default に出たもの: `ActivateBefore=True`, `ClickType=Single`, `DisplayName=クリック`, `HealingAgentBehavior=SameAsCard`, `KeyModifiers=None`, `MouseButton=Left`, `Version=V5`
- カタログに無いもの: なし
- default に出ない out/inout: `OutUiElement`
- default に出ない必須: なし

## NGetText

- default に出たもの: `DisplayName=テキストを取得`, `HealingAgentBehavior=SameAsCard`, `Version=V5`
- カタログに無いもの: なし
- default に出ない out/inout: `OutUiElement`, `Text`, `TextString`, `WordsInfo`
- default に出ない必須: なし

## NTypeInto

- default に出たもの: `ActivateBefore=True`, `ClickBeforeMode=Single`, `DisplayName=文字を入力`, `EmptyFieldMode=SingleLine`, `HealingAgentBehavior=SameAsCard`, `Version=V5`, `VerifyOptions=(要素)`
- カタログに無いもの: なし
- default に出ない out/inout: `OutUiElement`
- default に出ない必須: なし

## ReadTextFile

- default に出たもの: `Content={x:Null}`, `File={x:Null}`, `FileName={x:Null}`
- カタログに無いもの: なし
- default に出ない out/inout: なし
- default に出ない必須: なし

## RetryScope

- default に出たもの: `LogRetriedExceptions={x:Null}`, `RetriedExceptionsLogLevel={x:Null}`, `ActivityBody=(要素)`, `Condition=(要素)`
- カタログに無いもの: なし
- default に出ない out/inout: なし
- default に出ない必須: なし

## WriteTextFile

- default に出たもの: `File={x:Null}`, `FileName={x:Null}`, `Output={x:Null}`, `Text={x:Null}`
- カタログに無いもの: なし
- default に出ない out/inout: なし
- default に出ない必須: なし

