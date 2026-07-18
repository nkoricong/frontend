<template>
  <!-- ローディング -->
  <div v-if="loading" class="loading-overlay">
    <div class="text-center">
      <div class="spinner-border text-primary" style="width:3rem;height:3rem;" role="status"></div>
      <p class="mt-3">住居リストを読み込み中...</p>
    </div>
  </div>

  <main class="container-fluid py-2">

    <!-- ヘッダー -->
    <header class="sticky-top bg-white mb-2 py-2 border-bottom">
      <div class="d-flex justify-content-between align-items-center px-2">
        <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'settingsEditDetail' })">
          <i class="fas fa-arrow-circle-left fa-2x"></i>
          <div class="small">戻る</div>
        </button>

        <div class="text-center flex-grow-1">
          <div style="font-size:18px;font-weight:700;">住居リストの編集</div>
          <div class="small text-muted">{{ cardNo }}-{{ childNo }} ／ {{ houses.length }}件</div>
        </div>

        <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'mainMenu' })">
          <i class="fas fa-home fa-2x"></i>
          <div class="small">ホーム</div>
        </button>
      </div>
    </header>

    <!-- ツールバー -->
    <div class="d-flex flex-wrap gap-2 justify-content-end mb-2 px-2">
      <button class="btn btn-outline-secondary" @click="downloadCsvFormat">
        <i class="fas fa-file-alt"></i> CSVフォーマットのダウンロード
      </button>
      <button class="btn btn-outline-secondary" @click="exportCsv" :disabled="houses.length === 0">
        <i class="fas fa-file-export"></i> CSVエクスポート
      </button>
      <button class="btn btn-outline-secondary" @click="openImportModal" :disabled="busy">
        <i class="fas fa-file-import"></i> CSVインポート
      </button>
      <button class="btn btn-outline-primary" @click="openBulkEditModal" :disabled="busy || selectedIds.length < 2" title="2件以上選択すると一括編集できます">
        <i class="fas fa-edit"></i> 住戸情報の編集（{{ selectedIds.length }}件選択中）
      </button>
      <button class="btn btn-outline-secondary" @click="fetchHouses" :disabled="busy">
        <i class="fas fa-redo"></i> 再読み込み
      </button>
      <button class="btn btn-outline-secondary" @click="renumberIds" :disabled="busy">
        <i class="fas fa-list-ol"></i> ID振り直し
      </button>
      <button class="btn btn-primary" @click="openAddModal" :disabled="busy">
        <i class="fas fa-plus-circle"></i> 住戸の追加
      </button>
    </div>

    <!-- 一覧テーブル -->
    <div class="table-responsive px-2">
      <table class="table table-sm table-hover table-bordered align-middle">
        <thead class="table-light">
          <tr>
            <th style="width:36px;">
              <input type="checkbox" class="form-check-input" :checked="allSelected" @change="toggleSelectAll">
            </th>
            <th style="width:70px;">移動</th>
            <th style="width:60px;">#</th>
            <th>表札名</th>
            <th>建物名・部屋番号</th>
            <th>住所</th>
            <th>TEL / 種別</th>
            <th style="width:70px;">可否</th>
            <th style="width:210px;">操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="row in visibleRows" :key="row.kind === 'building' ? 'b-' + row.key : row.house.DetailID">
            <!-- 建物ヘッダー行：編集・複製・削除ボタンやチェックボックスは付けない -->
            <tr v-if="row.kind === 'building'" class="table-light building-row" style="cursor:pointer" @click="toggleGroup(row.key)">
              <td></td>
              <td></td>
              <td class="text-center">
                <i class="fas" :class="expandedGroups[row.key] ? 'fa-caret-up' : 'fa-caret-down'"></i>
              </td>
              <td class="small text-muted">{{ row.houses.length }}件</td>
              <td>
                <span v-if="buildingIconClass(row.houses[0].BuildingCategory)" class="me-1 text-secondary">
                  <i class="fas" :class="buildingIconClass(row.houses[0].BuildingCategory)"></i>
                </span>
                <b>{{ row.houses[0].BuildingName }}</b>
              </td>
              <td class="small">
                <span v-if="row.houses[0].AddressSW === '直接入力'">{{ row.houses[0].InputTownName }}{{ row.houses[0].InputCho }}{{ row.houses[0].InputBanchi }}</span>
                <span v-else>{{ row.houses[0].CSVTownName }}{{ row.houses[0].CSVCho }}{{ row.houses[0].CSVBanchi }}</span>
              </td>
              <td class="small text-muted">階数 {{ row.houses[0].Floors || "-" }} ／ 部屋数 {{ row.houses[0].Rooms || "-" }}</td>
              <td></td>
              <td></td>
            </tr>

            <!-- 住戸行（通常どおりの表示） -->
            <tr v-else>
              <td class="text-center">
                <input type="checkbox" class="form-check-input" :value="row.house.DetailID" v-model="selectedIds">
              </td>
              <td class="text-center">
                <button class="btn btn-sm btn-secondary mb-1" :disabled="row.index === 0" @click="moveRow(row.house, 'up')">
                  <i class="fas fa-chevron-up"></i>
                </button>
                <button class="btn btn-sm btn-secondary" :disabled="row.index === houses.length - 1" @click="moveRow(row.house, 'down')">
                  <i class="fas fa-chevron-down"></i>
                </button>
              </td>
              <td class="text-center fw-bold">
                <span v-if="row.grouped" class="text-muted me-1">└</span>{{ row.house.HousingNo }}
              </td>
              <td>{{ row.house.FamilyName || "（表札名なし）" }}</td>
              <td>{{ row.house.BuildingName }} {{ row.house.RoomNo }}</td>
              <td class="small">
                <span v-if="row.house.AddressSW === '直接入力'">{{ row.house.InputTownName }}{{ row.house.InputCho }}{{ row.house.InputBanchi }}</span>
                <span v-else>{{ row.house.CSVTownName }}{{ row.house.CSVCho }}{{ row.house.CSVBanchi }}</span>
              </td>
              <td class="small">{{ row.house.TEL }} {{ row.house.Type }}</td>
              <td class="text-center">
                <i v-if="row.house.NGFlag === '不可' || row.house.NGFlag === '訪問不可'" class="fas fa-ban text-danger" title="訪問不可"></i>
                <span v-else>可</span>
              </td>
              <td class="text-nowrap">
                <button class="btn btn-sm btn-outline-primary me-1" @click="openEditModal(row.house)">編集</button>
                <button class="btn btn-sm btn-outline-secondary me-1" @click="openCopyModal(row.house)">複製</button>
                <button class="btn btn-sm btn-outline-danger" @click="deleteRow(row.house)">削除</button>
              </td>
            </tr>
          </template>
          <tr v-if="houses.length === 0">
            <td colspan="9" class="text-center text-muted py-4">住戸データがありません</td>
          </tr>
        </tbody>
      </table>
    </div>

  </main>

  <!-- 編集・複製・追加モーダル -->
  <div v-if="showModal">
    <div class="modal-backdrop-custom" @click="closeModal"></div>
    <div class="modal d-block" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <span v-if="editMode === 'edit'">住戸情報の編集</span>
              <span v-else-if="editMode === 'copy'">住戸情報の複製</span>
              <span v-else>住戸情報の追加</span>
            </h5>
            <button type="button" class="btn-close" @click="closeModal"></button>
          </div>

          <div class="modal-body">
            <div class="row g-3">

              <div class="col-sm-6">
                <label class="form-label">区域種別</label>
                <select class="form-select" v-model="editForm.Type">
                  <option v-for="t in CardKinds" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>

              <div class="col-sm-6">
                <label class="form-label">表札名</label>
                <input type="text" class="form-control" v-model="editForm.FamilyName">
              </div>

              <div class="col-sm-4">
                <label class="form-label">建物番号（旧・自由入力）</label>
                <input type="text" class="form-control" v-model="editForm.BuildingNoLegacy">
              </div>

              <div class="col-sm-8">
                <label class="form-label d-block">建物情報の入力方法</label>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="radio" id="building-sw-master" value="建物マスタから選択" v-model="editForm.BuildingSW">
                  <label class="form-check-label" for="building-sw-master">建物マスタから選択</label>
                </div>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="radio" id="building-sw-input" value="直接入力" v-model="editForm.BuildingSW">
                  <label class="form-check-label" for="building-sw-input">直接入力</label>
                </div>
              </div>

              <template v-if="editForm.BuildingSW === '建物マスタから選択'">
                <div class="col-sm-12">
                  <label class="form-label">建物マスタ</label>
                  <select class="form-select" v-model.number="editForm.BuildingNo" @change="onBuildingMasterChange">
                    <option :value="null" disabled>-選択-</option>
                    <option v-for="b in buildingMasterOptions" :key="b.BuildingNo" :value="b.BuildingNo">
                      {{ b.BuildingNo }}：{{ b.BuildingName }}
                    </option>
                  </select>
                </div>
                <div class="col-sm-4">
                  <label class="form-label">建物種別</label>
                  <div class="d-flex align-items-center gap-2">
                    <i v-if="buildingIconClass(editForm.BuildingCategory)" class="fas text-secondary" :class="buildingIconClass(editForm.BuildingCategory)"></i>
                    <input type="text" class="form-control" :value="editForm.BuildingCategory" disabled>
                  </div>
                </div>
                <div class="col-sm-4">
                  <label class="form-label">建物名</label>
                  <input type="text" class="form-control" :value="editForm.BuildingName" disabled>
                </div>
                <div class="col-sm-2">
                  <label class="form-label">階数</label>
                  <input type="text" class="form-control" :value="editForm.Floors" disabled>
                </div>
                <div class="col-sm-2">
                  <label class="form-label">部屋数</label>
                  <input type="text" class="form-control" :value="editForm.Rooms" disabled>
                </div>
              </template>
              <template v-else>
                <div class="col-sm-4">
                  <label class="form-label">建物種別</label>
                  <div class="d-flex align-items-center gap-2">
                    <i v-if="buildingIconClass(editForm.BuildingCategory)" class="fas text-secondary" :class="buildingIconClass(editForm.BuildingCategory)"></i>
                    <select class="form-select" v-model="editForm.BuildingCategory">
                      <option v-for="b in BuildKinds" :key="b" :value="b">{{ b }}</option>
                    </select>
                  </div>
                </div>
                <div class="col-sm-4" v-if="editForm.BuildingCategory !== '戸建て'">
                  <label class="form-label">建物名</label>
                  <input type="text" class="form-control" v-model="editForm.BuildingName">
                </div>
                <div class="col-sm-2">
                  <label class="form-label">階数</label>
                  <input type="text" class="form-control" v-model="editForm.Floors">
                </div>
                <div class="col-sm-2">
                  <label class="form-label">部屋数</label>
                  <input type="text" class="form-control" v-model="editForm.Rooms">
                </div>
              </template>

              <div class="col-sm-4" v-if="editForm.BuildingCategory !== '戸建て'">
                <label class="form-label">部屋番号</label>
                <input type="text" class="form-control" v-model="editForm.RoomNo">
              </div>

              <div class="col-sm-12"><hr><b>住所</b></div>

              <div class="col-sm-12">
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="radio" id="addr-sw-list" value="リストから選択" v-model="editForm.AddressSW">
                  <label class="form-check-label" for="addr-sw-list">リストから選択</label>
                </div>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="radio" id="addr-sw-input" value="直接入力" v-model="editForm.AddressSW">
                  <label class="form-check-label" for="addr-sw-input">直接入力</label>
                </div>
              </div>

              <template v-if="editForm.AddressSW === '直接入力'">
                <div class="col-sm-4">
                  <label class="form-label">町名</label>
                  <select class="form-select" v-model="editForm.InputTownName">
                    <option value="" disabled>-選択-</option>
                    <option v-for="t in townOptions" :key="t" :value="t">{{ t }}</option>
                  </select>
                </div>
                <div class="col-sm-4">
                  <label class="form-label">番地</label>
                  <input type="text" class="form-control" v-model="editForm.InputCho">
                </div>
                <div class="col-sm-4">
                  <label class="form-label">号</label>
                  <input type="text" class="form-control" v-model="editForm.InputBanchi">
                </div>
              </template>
              <template v-else>
                <div class="col-sm-4">
                  <label class="form-label">町名</label>
                  <select class="form-select" v-model="editForm.CSVTownName" @change="onTownChange">
                    <option value="" disabled>-選択-</option>
                    <option v-for="t in townOptions" :key="t" :value="t">{{ t }}</option>
                  </select>
                </div>
                <div class="col-sm-4">
                  <label class="form-label">番地</label>
                  <select class="form-select" v-model="editForm.CSVCho" @change="onChoChange">
                    <option value="" disabled>-選択-</option>
                    <option v-for="c in choOptions" :key="c" :value="c">{{ c }}</option>
                  </select>
                </div>
                <div class="col-sm-4">
                  <label class="form-label">号</label>
                  <select class="form-select" v-model="editForm.CSVBanchi" @change="onBanchiChange">
                    <option value="" disabled>-選択-</option>
                    <option v-for="b in banchiOptions" :key="b.Banchi" :value="b.Banchi">{{ b.Banchi }}</option>
                  </select>
                </div>
              </template>

              <div class="col-sm-12">
                <label class="form-label">緯度・経度</label>
                <div class="d-flex gap-1 mb-1">
                  <input class="form-control" v-model="editForm.CSVLat" placeholder="緯度　例）34.768660059488724">
                  <input class="form-control" v-model="editForm.CSVLng" placeholder="経度　例）135.59748150473885">
                </div>
                <div class="d-flex gap-2">
                  <button type="button" class="btn btn-sm btn-outline-secondary" @click="pasteClipboard">
                    <i class="fas fa-paste"></i> 貼り付け
                  </button>
                  <button type="button" class="btn btn-sm btn-outline-secondary" @click="openMapPicker">
                    <i class="fas fa-map-marker-alt"></i> 地図で指定
                  </button>
                </div>
                <div class="form-text">
                  Googleマップアプリで地点を長押し→座標をコピーし、[貼り付け]を押すと自動入力されます。
                </div>
              </div>

              <div class="col-sm-12"><hr><b>電話番号</b></div>

              <div class="col-sm-4">
                <label class="form-label">TEL番号</label>
                <input type="text" class="form-control" v-model="editForm.TEL">
              </div>

              <div class="col-sm-4">
                <label class="form-label">情報源</label>
                <select class="form-select" v-model="editForm.TELSource">
                  <option v-for="s in TelSourceKinds" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>

              <div class="col-sm-4">
                <label class="form-label">入力日</label>
                <input type="date" class="form-control" v-model="editForm.TELUpdateDate">
              </div>

              <div class="col-sm-12"><hr><b>可否・その他</b></div>

              <div class="col-sm-3">
                <label class="form-label">可否</label>
                <select class="form-select" v-model="editForm.NGFlag" @change="onNgFlagChange">
                  <option v-for="n in NGStatus" :key="n" :value="n">{{ n }}</option>
                </select>
              </div>

              <template v-if="editForm.NGFlag === '不可' || editForm.NGFlag === '訪問不可'">
                <div class="col-sm-3">
                  <label class="form-label">記録日</label>
                  <input type="date" class="form-control" v-model="editForm.NGDate">
                </div>
                <div class="col-sm-3">
                  <label class="form-label">奉仕監督確認</label>
                  <select class="form-select" v-model="editForm.NGChecked">
                    <option v-for="c in NGCheckSels" :key="c" :value="c">{{ c }}</option>
                  </select>
                </div>
                <div class="col-sm-12">
                  <label class="form-label">説明</label>
                  <textarea class="form-control" rows="2" maxlength="128" v-model="editForm.NGComment"></textarea>
                </div>
              </template>

              <div class="col-sm-6">
                <div class="form-check mt-4">
                  <input class="form-check-input" type="checkbox" id="ygFlag" v-model="youngerGenChecked">
                  <label class="form-check-label" for="ygFlag">若い世代・年少者フラグ</label>
                </div>
              </div>

              <div class="col-sm-12">
                <label class="form-label">備考（Note）</label>
                <textarea class="form-control" rows="2" v-model="editForm.Note"></textarea>
              </div>

              <div class="col-sm-12">
                <label class="form-label">コメント（Comment）</label>
                <textarea class="form-control" rows="2" v-model="editForm.Comment"></textarea>
              </div>

              <div class="col-sm-12">
                <label class="form-label">備考（Description）</label>
                <textarea class="form-control" rows="2" maxlength="128" v-model="editForm.Description"></textarea>
              </div>

            </div>
            <p v-if="saveError" class="text-danger small mt-2 mb-0">{{ saveError }}</p>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" @click="closeModal">閉じる</button>
            <button class="btn btn-primary" @click="saveForm" :disabled="busy">
              {{ editMode === "edit" ? "更新" : "登録" }}
            </button>
          </div>

          <!-- 地図で地点を指定するミニマップ -->
          <div v-if="showMapPicker" class="map-picker-overlay">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <strong class="small">地図をクリックして地点を指定してください</strong>
              <button type="button" class="btn-close" @click="closeMapPicker"></button>
            </div>
            <div ref="pickerMapContainer" class="picker-map"></div>
            <div class="d-flex justify-content-end gap-2 mt-2">
              <button type="button" class="btn btn-sm btn-secondary" @click="closeMapPicker">キャンセル</button>
              <button type="button" class="btn btn-sm btn-primary" @click="confirmMapPicker">この地点に決定</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>

  <!-- 一括編集モーダル（#99） -->
  <div v-if="showBulkModal">
    <div class="modal-backdrop-custom" @click="closeBulkModal"></div>
    <div class="modal d-block" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">住戸情報の一括編集（{{ selectedIds.length }}件）</h5>
            <button type="button" class="btn-close" @click="closeBulkModal"></button>
          </div>

          <div class="modal-body">
            <p class="text-muted small">
              チェックを入れた項目のみ、選択中の全レコードに同じ値を一括反映します。
              チェックを入れない項目は各レコードの現在の値のまま変更しません。
            </p>
            <div class="row g-3">

              <div class="col-sm-6">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="bulk-apply-type" v-model="bulkForm.type.apply">
                  <label class="form-check-label" for="bulk-apply-type">区域種別を変更する</label>
                </div>
                <select class="form-select" v-model="bulkForm.type.value" :disabled="!bulkForm.type.apply">
                  <option v-for="t in CardKinds" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>

              <div class="col-sm-6">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="bulk-apply-family" v-model="bulkForm.familyName.apply">
                  <label class="form-check-label" for="bulk-apply-family">表札名を変更する</label>
                </div>
                <input type="text" class="form-control" v-model="bulkForm.familyName.value" :disabled="!bulkForm.familyName.apply">
              </div>

              <div class="col-sm-12">
                <hr>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="bulk-apply-building" v-model="bulkForm.building.apply">
                  <label class="form-check-label"><b>建物情報（建物種別・入力方法・建物マスタ・建物名・階数・部屋数）を変更する</b></label>
                </div>
              </div>

              <template v-if="bulkForm.building.apply">
                <div class="col-sm-8">
                  <label class="form-label d-block">建物情報の入力方法</label>
                  <div class="form-check form-check-inline">
                    <input class="form-check-input" type="radio" id="bulk-building-sw-master" value="建物マスタから選択" v-model="bulkForm.building.BuildingSW">
                    <label class="form-check-label" for="bulk-building-sw-master">建物マスタから選択</label>
                  </div>
                  <div class="form-check form-check-inline">
                    <input class="form-check-input" type="radio" id="bulk-building-sw-input" value="直接入力" v-model="bulkForm.building.BuildingSW">
                    <label class="form-check-label" for="bulk-building-sw-input">直接入力</label>
                  </div>
                </div>

                <template v-if="bulkForm.building.BuildingSW === '建物マスタから選択'">
                  <div class="col-sm-12">
                    <label class="form-label">建物マスタ</label>
                    <select class="form-select" v-model.number="bulkForm.building.BuildingNo" @change="onBulkBuildingMasterChange">
                      <option :value="null" disabled>-選択-</option>
                      <option v-for="b in buildingMasterOptions" :key="b.BuildingNo" :value="b.BuildingNo">
                        {{ b.BuildingNo }}：{{ b.BuildingName }}
                      </option>
                    </select>
                  </div>
                  <div class="col-sm-4">
                    <label class="form-label">建物種別</label>
                    <input type="text" class="form-control" :value="bulkForm.building.BuildingCategory" disabled>
                  </div>
                  <div class="col-sm-4">
                    <label class="form-label">建物名</label>
                    <input type="text" class="form-control" :value="bulkForm.building.BuildingName" disabled>
                  </div>
                  <div class="col-sm-2">
                    <label class="form-label">階数</label>
                    <input type="text" class="form-control" :value="bulkForm.building.Floors" disabled>
                  </div>
                  <div class="col-sm-2">
                    <label class="form-label">部屋数</label>
                    <input type="text" class="form-control" :value="bulkForm.building.Rooms" disabled>
                  </div>
                </template>
                <template v-else>
                  <div class="col-sm-4">
                    <label class="form-label">建物種別</label>
                    <select class="form-select" v-model="bulkForm.building.BuildingCategory">
                      <option v-for="b in BuildKinds" :key="b" :value="b">{{ b }}</option>
                    </select>
                  </div>
                  <div class="col-sm-4">
                    <label class="form-label">建物名</label>
                    <input type="text" class="form-control" v-model="bulkForm.building.BuildingName">
                  </div>
                  <div class="col-sm-2">
                    <label class="form-label">階数</label>
                    <input type="text" class="form-control" v-model="bulkForm.building.Floors">
                  </div>
                  <div class="col-sm-2">
                    <label class="form-label">部屋数</label>
                    <input type="text" class="form-control" v-model="bulkForm.building.Rooms">
                  </div>
                </template>
              </template>

              <div class="col-sm-12">
                <hr>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="bulk-apply-address" v-model="bulkForm.address.apply">
                  <label class="form-check-label"><b>住所（入力方法・町名・番地・号）を変更する</b></label>
                </div>
              </div>

              <template v-if="bulkForm.address.apply">
                <div class="col-sm-12">
                  <div class="form-check form-check-inline">
                    <input class="form-check-input" type="radio" id="bulk-addr-sw-list" value="リストから選択" v-model="bulkForm.address.AddressSW">
                    <label class="form-check-label" for="bulk-addr-sw-list">リストから選択</label>
                  </div>
                  <div class="form-check form-check-inline">
                    <input class="form-check-input" type="radio" id="bulk-addr-sw-input" value="直接入力" v-model="bulkForm.address.AddressSW">
                    <label class="form-check-label" for="bulk-addr-sw-input">直接入力</label>
                  </div>
                </div>

                <template v-if="bulkForm.address.AddressSW === '直接入力'">
                  <div class="col-sm-4">
                    <label class="form-label">町名</label>
                    <select class="form-select" v-model="bulkForm.address.InputTownName">
                      <option value="" disabled>-選択-</option>
                      <option v-for="t in townOptions" :key="t" :value="t">{{ t }}</option>
                    </select>
                  </div>
                  <div class="col-sm-4">
                    <label class="form-label">番地</label>
                    <input type="text" class="form-control" v-model="bulkForm.address.InputCho">
                  </div>
                  <div class="col-sm-4">
                    <label class="form-label">号</label>
                    <input type="text" class="form-control" v-model="bulkForm.address.InputBanchi">
                  </div>
                </template>
                <template v-else>
                  <div class="col-sm-4">
                    <label class="form-label">町名</label>
                    <select class="form-select" v-model="bulkForm.address.CSVTownName" @change="onBulkTownChange">
                      <option value="" disabled>-選択-</option>
                      <option v-for="t in townOptions" :key="t" :value="t">{{ t }}</option>
                    </select>
                  </div>
                  <div class="col-sm-4">
                    <label class="form-label">番地</label>
                    <select class="form-select" v-model="bulkForm.address.CSVCho" @change="onBulkChoChange">
                      <option value="" disabled>-選択-</option>
                      <option v-for="c in choOptions" :key="c" :value="c">{{ c }}</option>
                    </select>
                  </div>
                  <div class="col-sm-4">
                    <label class="form-label">号</label>
                    <select class="form-select" v-model="bulkForm.address.CSVBanchi" @change="onBulkBanchiChange">
                      <option value="" disabled>-選択-</option>
                      <option v-for="b in banchiOptions" :key="b.Banchi" :value="b.Banchi">{{ b.Banchi }}</option>
                    </select>
                  </div>
                </template>
              </template>

              <div class="col-sm-12">
                <hr>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="bulk-apply-location" v-model="bulkForm.location.apply">
                  <label class="form-check-label"><b>緯度・経度を変更する</b></label>
                </div>
              </div>

              <div class="col-sm-12" v-if="bulkForm.location.apply">
                <div class="d-flex gap-1 mb-1">
                  <input class="form-control" v-model="bulkForm.location.CSVLat" placeholder="緯度　例）34.768660059488724">
                  <input class="form-control" v-model="bulkForm.location.CSVLng" placeholder="経度　例）135.59748150473885">
                </div>
                <button type="button" class="btn btn-sm btn-outline-secondary" @click="openBulkMapPicker">
                  <i class="fas fa-map-marker-alt"></i> 地図で指定
                </button>
              </div>

              <div class="col-sm-12"><hr></div>

              <div class="col-sm-6">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="bulk-apply-ng" v-model="bulkForm.ngFlag.apply">
                  <label class="form-check-label">訪問可否を変更する</label>
                </div>
                <select class="form-select" v-model="bulkForm.ngFlag.value" :disabled="!bulkForm.ngFlag.apply">
                  <option v-for="n in NGStatus" :key="n" :value="n">{{ n }}</option>
                </select>
              </div>

              <div class="col-sm-6">
                <div class="form-check mt-4">
                  <input class="form-check-input" type="checkbox" id="bulk-apply-yg" v-model="bulkForm.youngerGen.apply">
                  <label class="form-check-label">若い世代・年少者フラグを変更する</label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="bulk-yg-value" v-model="bulkForm.youngerGen.value" :disabled="!bulkForm.youngerGen.apply">
                  <label class="form-check-label" for="bulk-yg-value">該当する</label>
                </div>
              </div>

            </div>
            <p v-if="bulkSaveError" class="text-danger small mt-2 mb-0">{{ bulkSaveError }}</p>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" @click="closeBulkModal">閉じる</button>
            <button class="btn btn-primary" @click="saveBulkForm" :disabled="bulkSaving || !bulkHasAnyApply">
              {{ bulkSaving ? "保存中..." : `${selectedIds.length}件に反映` }}
            </button>
          </div>

          <!-- 地図で地点を指定するミニマップ（一括編集用） -->
          <div v-if="showBulkMapPicker" class="map-picker-overlay">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <strong class="small">地図をクリックして地点を指定してください</strong>
              <button type="button" class="btn-close" @click="closeBulkMapPicker"></button>
            </div>
            <div ref="bulkPickerMapContainer" class="picker-map"></div>
            <div class="d-flex justify-content-end gap-2 mt-2">
              <button type="button" class="btn btn-sm btn-secondary" @click="closeBulkMapPicker">キャンセル</button>
              <button type="button" class="btn btn-sm btn-primary" @click="confirmBulkMapPicker">この地点に決定</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>

  <!-- CSVインポートモーダル（#102） -->
  <div v-if="showImportModal">
    <div class="modal-backdrop-custom" @click="closeImportModal"></div>
    <div class="modal d-block" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">住戸リストのCSVインポート</h5>
            <button type="button" class="btn-close" @click="closeImportModal"></button>
          </div>

          <div class="modal-body">
            <p class="text-muted small mb-2">
              「CSVフォーマットのダウンロード」で取得したCSVと同じ列構成のファイルを選択してください。
              DetailID列が空欄の行は新規追加、この住戸リストに存在するDetailIDが入力された行はその住戸を上書き更新します。
            </p>
            <input type="file" class="form-control" accept=".csv" @change="onImportFileChange">
            <p v-if="importParseMessage" class="mt-2 mb-0 small">{{ importParseMessage }}</p>

            <div v-if="importRows.length > 0" class="table-responsive mt-3">
              <p class="small text-muted mb-1">プレビュー（先頭{{ importPreviewRows.length }}件 / 全{{ importRows.length }}件）</p>
              <table class="table table-sm table-bordered">
                <thead>
                  <tr>
                    <th>DetailID</th>
                    <th>表札名</th>
                    <th>建物名</th>
                    <th>住所</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in importPreviewRows" :key="idx">
                    <td>{{ row.DetailID || "（新規）" }}</td>
                    <td>{{ row.FamilyName }}</td>
                    <td>{{ row.BuildingName }}</td>
                    <td class="small">
                      <span v-if="row.AddressSW === '直接入力'">{{ row.InputTownName }}{{ row.InputCho }}{{ row.InputBanchi }}</span>
                      <span v-else>{{ row.CSVTownName }}{{ row.CSVCho }}{{ row.CSVBanchi }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p v-if="importResultMessage" class="small mt-2 mb-0" :class="importResultOk ? 'text-success' : 'text-danger'">{{ importResultMessage }}</p>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" @click="closeImportModal">閉じる</button>
            <button class="btn btn-primary" :disabled="importRows.length === 0 || importing" @click="runCsvImport">
              <span v-if="importing"><i class="fas fa-spinner fa-spin"></i> インポート中...（{{ importedCount }} / {{ importRows.length }}件）</span>
              <span v-else>インポート実行</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/store/authStore.js";
import { buildingIconClass } from "@/utils/buildingIcons.js";
import { groupHousesByBuilding } from "@/utils/buildingGroups.js";
import { loadGoogleMaps, createMap, addMarker } from "@/services/maps.js";
import { resolveMapCenter } from "@/services/mapCenter.js";
import { buildCsv, downloadCsv, parseCsvWithHeader } from "@/utils/csv.js";
import {
  getChildDetail,
  upsertDetail,
  deleteDetail,
  moveDetailRow,
  renumberDetailList,
  searchBuildingMaster,
  getKibanTowns,
  getKibanChoList,
  getKibanBanchiList,
  getKibanNearest,
} from "@/services/api.js";

const props = defineProps({
  cardNo:  { type: Number, required: true },
  childNo: { type: Number, required: true },
});

const router    = useRouter();
const authStore = useAuthStore();

const loading = ref(true);
const busy    = ref(false);
const houses  = ref([]);
const saveError = ref("");

// ---- 一括編集用の選択状態（#99） ----
const selectedIds = ref([]);
const allSelected  = computed(() => houses.value.length > 0 && selectedIds.value.length === houses.value.length);
function toggleSelectAll() {
  selectedIds.value = allSelected.value ? [] : houses.value.map(h => h.DetailID);
}

// ---- 建物単位のアコーディオン表示（#100） ----
// キー: 建物グループキー、値: 展開中かどうか
const expandedGroups = reactive({});
function toggleGroup(key) {
  expandedGroups[key] = !expandedGroups[key];
}

// 表示行を「建物ヘッダー行」「住戸行」が混在する1本のリストに平坦化する。
// 住戸行には、移動ボタンの有効/無効判定に使う houses 内での元の位置（index）も持たせる。
const visibleRows = computed(() => {
  const indexById = new Map(houses.value.map((h, i) => [h.DetailID, i]));
  const rows = [];
  for (const entry of groupHousesByBuilding(houses.value)) {
    if (entry.type === "house") {
      rows.push({ kind: "house", house: entry.house, index: indexById.get(entry.house.DetailID), grouped: false });
      continue;
    }
    rows.push({ kind: "building", key: entry.key, houses: entry.houses });
    if (expandedGroups[entry.key]) {
      for (const h of entry.houses) {
        rows.push({ kind: "house", house: h, index: indexById.get(h.DetailID), grouped: true });
      }
    }
  }
  return rows;
});

const showModal = ref(false);
const editMode  = ref("add"); // 'add' | 'copy' | 'edit'
const editForm  = ref({});

// 選択肢（legacy EditDetailList.html の定数をそのまま踏襲）
const CardKinds      = ["家から家", "オートロック", "商店・会社"];
const BuildKinds      = ["戸建て", "長屋", "アパート", "マンション", "オートロック", "寮", "店舗", "事務所", "工場", "倉庫", "各種施設", "駐車場", "空地", "空き家", "その他"];
const TelSourceKinds  = ["ハローページ", "タウンページ", "公式ウェブサイト", "民間の情報サイト等", "看板・掲示物", "チラシ・広告", "公式情報", "官公庁/公共団体の公開情報", "直接入手", "未確認", "過去リストから移行", "その他"];
const NGStatus        = ["可", "不可", "訪問不可"];
const NGCheckSels     = ["未確認", "確認済"];

// YoungerGENFlag は真偽値/文字列どちらの表現でも扱えるようにチェックボックスと相互変換
const youngerGenChecked = computed({
  get: () => !!editForm.value.YoungerGENFlag && editForm.value.YoungerGENFlag !== "" && editForm.value.YoungerGENFlag !== "0",
  set: (v) => { editForm.value.YoungerGENFlag = v ? "該当" : ""; },
});

function blankForm() {
  return {
    DetailID: null,
    CardNo:   props.cardNo,
    ChildNo:  props.childNo,
    Type:     "家から家",
    BuildingNoLegacy: "",
    BuildingSW: "直接入力",
    BuildingNo: null,
    BuildingCategory: "戸建て",
    BuildingName: "",
    Floors: "",
    Rooms: "",
    RoomNo: "",
    FamilyName: "",
    TEL: "",
    TELSource: "未確認",
    TELUpdateDate: "",
    Comment: "",
    Note: "",
    CSVTownName: "",
    CSVCho: "",
    CSVBanchi: "",
    CSVLat: "",
    CSVLng: "",
    InputTownName: "",
    InputCho: "",
    InputBanchi: "",
    AddressSW: "リストから選択",
    NGFlag: "可",
    NGDate: "",
    NGComment: "",
    NGSarvant: "",
    NGChecked: "未確認",
    YoungerGENFlag: "",
    Description: "",
  };
}

async function fetchHouses() {
  busy.value = true;
  try {
    const res = await getChildDetail(props.cardNo, props.childNo);
    if (res.status === "success") {
      houses.value = res.houses;
      const stillExists = new Set(houses.value.map(h => h.DetailID));
      selectedIds.value = selectedIds.value.filter(id => stillExists.has(id));
    }
  } catch (e) {
    console.error(e);
  } finally {
    busy.value = false;
    loading.value = false;
  }
}

async function openAddModal() {
  editMode.value = "add";
  editForm.value = blankForm();
  saveError.value = "";
  showModal.value = true;
  await ensureTownsLoaded();
  await ensureBuildingMasterLoaded();
}

async function openCopyModal(h) {
  editMode.value = "copy";
  saveError.value = "";
  editForm.value = {
    ...blankForm(),
    Type: h.Type,
    BuildingNoLegacy: h.BuildingNoLegacy,
    BuildingSW: h.BuildingNo ? "建物マスタから選択" : "直接入力",
    BuildingNo: h.BuildingNo,
    BuildingCategory: h.BuildingCategory,
    BuildingName: h.BuildingName,
    Floors: h.Floors,
    Rooms: h.Rooms,
    RoomNo: h.RoomNo,
    CSVTownName: h.CSVTownName,
    CSVCho: h.CSVCho,
    CSVBanchi: h.CSVBanchi,
    CSVLat: h.CSVLat,
    CSVLng: h.CSVLng,
    InputTownName: h.InputTownName,
    InputCho: h.InputCho,
    InputBanchi: h.InputBanchi,
    AddressSW: h.AddressSW,
  };
  showModal.value = true;
  await ensureTownsLoaded();
  await ensureBuildingMasterLoaded();
  if (editForm.value.CSVTownName) await loadChoOptions(editForm.value.CSVTownName);
  if (editForm.value.CSVTownName && editForm.value.CSVCho) await loadBanchiOptions(editForm.value.CSVTownName, editForm.value.CSVCho);
}

async function openEditModal(h) {
  editMode.value = "edit";
  editForm.value = {
    ...h,
    BuildingSW: h.BuildingNo ? "建物マスタから選択" : "直接入力",
  };
  // 既にNGFlagが「不可」なのに記録日が未設定の既存データは、本日日付を初期表示する
  if (editForm.value.NGFlag === "不可" && !editForm.value.NGDate) {
    editForm.value.NGDate = new Date().toISOString().slice(0, 10);
  }
  saveError.value = "";
  showModal.value = true;
  await ensureTownsLoaded();
  await ensureBuildingMasterLoaded();
  if (editForm.value.CSVTownName) await loadChoOptions(editForm.value.CSVTownName);
  if (editForm.value.CSVTownName && editForm.value.CSVCho) await loadBanchiOptions(editForm.value.CSVTownName, editForm.value.CSVCho);
}

function closeModal() {
  showModal.value = false;
  closeMapPicker();
}

async function saveForm() {
  busy.value = true;
  saveError.value = "";
  try {
    const res = await upsertDetail(editForm.value);
    if (res.status === "success") {
      showModal.value = false;
      await fetchHouses();
    } else {
      saveError.value = res.message || "保存に失敗しました";
    }
  } catch (e) {
    console.error(e);
    saveError.value = e.message || "保存に失敗しました";
  } finally {
    busy.value = false;
  }
}

// ---- 一括編集（#99） ----
const showBulkModal  = ref(false);
const bulkSaving     = ref(false);
const bulkSaveError  = ref("");

function blankBulkForm() {
  return {
    type:       { apply: false, value: "家から家" },
    familyName: { apply: false, value: "" },
    building: {
      apply: false,
      BuildingSW: "直接入力",
      BuildingNo: null,
      BuildingCategory: "戸建て",
      BuildingName: "",
      Floors: "",
      Rooms: "",
    },
    address: {
      apply: false,
      AddressSW: "リストから選択",
      CSVTownName: "", CSVCho: "", CSVBanchi: "",
      InputTownName: "", InputCho: "", InputBanchi: "",
    },
    location: { apply: false, CSVLat: "", CSVLng: "" },
    ngFlag:     { apply: false, value: "可" },
    youngerGen: { apply: false, value: false },
  };
}
const bulkForm = ref(blankBulkForm());

const bulkHasAnyApply = computed(() => Object.values(bulkForm.value).some(f => f.apply));

async function openBulkEditModal() {
  if (selectedIds.value.length < 2) return;
  bulkForm.value = blankBulkForm();
  bulkSaveError.value = "";
  showBulkModal.value = true;
  await ensureTownsLoaded();
  await ensureBuildingMasterLoaded();
}

function closeBulkModal() {
  showBulkModal.value = false;
  closeBulkMapPicker();
}

function onBulkTownChange() {
  bulkForm.value.address.CSVCho    = "";
  bulkForm.value.address.CSVBanchi = "";
  loadChoOptions(bulkForm.value.address.CSVTownName);
}
function onBulkChoChange() {
  bulkForm.value.address.CSVBanchi = "";
  loadBanchiOptions(bulkForm.value.address.CSVTownName, bulkForm.value.address.CSVCho);
}
function onBulkBanchiChange() {
  const b = banchiOptions.value.find(b => b.Banchi === bulkForm.value.address.CSVBanchi);
  if (b) {
    if (b.Lat != null) bulkForm.value.location.CSVLat = b.Lat;
    if (b.Lng != null) bulkForm.value.location.CSVLng = b.Lng;
  }
}

function onBulkBuildingMasterChange() {
  const b = buildingMasterOptions.value.find(b => b.BuildingNo === bulkForm.value.building.BuildingNo);
  if (b) {
    bulkForm.value.building.BuildingCategory = b.BuildingCategory;
    bulkForm.value.building.BuildingName     = b.BuildingName;
    bulkForm.value.building.Floors           = b.Floors;
    bulkForm.value.building.Rooms            = b.Rooms;
  }
}

// ---- 一括編集：地図で地点を指定 ----
const showBulkMapPicker = ref(false);
const bulkPickerMapContainer = ref(null);
let bulkPickerMapInstance = null;
let bulkPickerMarker = null;

async function openBulkMapPicker() {
  showBulkMapPicker.value = true;
  await nextTick();
  try {
    await loadGoogleMaps();
    const center = await resolveMapCenter(bulkForm.value.location, []);
    bulkPickerMapInstance = createMap(bulkPickerMapContainer.value, center, 15);
    bulkPickerMarker = addMarker(bulkPickerMapInstance, center, "");
    bulkPickerMapInstance.addListener("click", (e) => {
      bulkPickerMarker.setPosition(e.latLng);
    });
  } catch (e) {
    console.error("地図の初期化に失敗しました:", e);
  }
}

function confirmBulkMapPicker() {
  if (bulkPickerMarker) {
    const pos = bulkPickerMarker.getPosition();
    bulkForm.value.location.CSVLat = pos.lat();
    bulkForm.value.location.CSVLng = pos.lng();
  }
  closeBulkMapPicker();
}

function closeBulkMapPicker() {
  showBulkMapPicker.value = false;
  bulkPickerMapInstance = null;
  bulkPickerMarker = null;
}

async function saveBulkForm() {
  if (!bulkHasAnyApply.value) return;
  bulkSaving.value = true;
  bulkSaveError.value = "";
  try {
    const f = bulkForm.value;
    const targets = houses.value.filter(h => selectedIds.value.includes(h.DetailID));

    for (const h of targets) {
      const merged = { ...h };

      if (f.type.apply)       merged.Type       = f.type.value;
      if (f.familyName.apply) merged.FamilyName = f.familyName.value;

      if (f.building.apply) {
        merged.BuildingCategory = f.building.BuildingCategory;
        merged.BuildingName     = f.building.BuildingName;
        merged.Floors           = f.building.Floors;
        merged.Rooms            = f.building.Rooms;
        merged.BuildingNo       = f.building.BuildingSW === "建物マスタから選択" ? f.building.BuildingNo : null;
      }

      if (f.address.apply) {
        merged.AddressSW = f.address.AddressSW;
        if (f.address.AddressSW === "直接入力") {
          merged.InputTownName = f.address.InputTownName;
          merged.InputCho      = f.address.InputCho;
          merged.InputBanchi   = f.address.InputBanchi;
        } else {
          merged.CSVTownName = f.address.CSVTownName;
          merged.CSVCho      = f.address.CSVCho;
          merged.CSVBanchi   = f.address.CSVBanchi;
        }
      }

      if (f.location.apply) {
        merged.CSVLat = f.location.CSVLat;
        merged.CSVLng = f.location.CSVLng;
      }

      if (f.ngFlag.apply) {
        merged.NGFlag = f.ngFlag.value;
        if (merged.NGFlag === "不可" && !merged.NGDate) {
          merged.NGDate    = new Date().toISOString().slice(0, 10);
          merged.NGSarvant = authStore.userName;
          merged.NGChecked = "未確認";
        }
      }

      if (f.youngerGen.apply) merged.YoungerGENFlag = f.youngerGen.value ? "該当" : "";

      const res = await upsertDetail(merged);
      if (res.status !== "success") throw new Error(res.message || `住戸ID:${h.DetailID} の保存に失敗しました`);
    }

    showBulkModal.value = false;
    selectedIds.value = [];
    await fetchHouses();
  } catch (e) {
    console.error(e);
    bulkSaveError.value = e.message || "保存に失敗しました";
  } finally {
    bulkSaving.value = false;
  }
}

// ---- CSVインポート／エクスポート（#102） ----
// エクスポート／インポートの列構成。順序がそのままCSVの列順・ヘッダー名になる。
// CardNo/ChildNoは意図的に含めない（このURLのカード・子カードに常に紐づけて取り込むため）。
const CSV_COLUMNS = [
  "DetailID", "HousingNo", "Type", "FamilyName",
  "BuildingNoLegacy", "BuildingSW", "BuildingNo", "BuildingCategory", "BuildingName", "Floors", "Rooms", "RoomNo",
  "AddressSW", "CSVTownName", "CSVCho", "CSVBanchi", "InputTownName", "InputCho", "InputBanchi", "CSVLat", "CSVLng",
  "TEL", "TELSource", "TELUpdateDate",
  "NGFlag", "NGDate", "NGComment", "NGSarvant", "NGChecked",
  "YoungerGENFlag", "Note", "Comment", "Description",
];

function downloadCsvFormat() {
  downloadCsv(buildCsv(CSV_COLUMNS, []), "住戸リストCSVフォーマット.csv");
}

function exportCsv() {
  const rows = houses.value.map(h => ({
    ...h,
    BuildingSW: h.BuildingNo ? "建物マスタから選択" : "直接入力",
  }));
  downloadCsv(buildCsv(CSV_COLUMNS, rows), `住戸リスト_${props.cardNo}-${props.childNo}.csv`);
}


const showImportModal    = ref(false);
const importRows         = ref([]);
const importParseMessage = ref("");
const importing          = ref(false);
const importedCount      = ref(0);
const importResultMessage = ref("");
const importResultOk      = ref(false);

const importPreviewRows = computed(() => importRows.value.slice(0, 10));

function openImportModal() {
  showImportModal.value    = true;
  importRows.value         = [];
  importParseMessage.value = "";
  importResultMessage.value = "";
}

function closeImportModal() {
  showImportModal.value = false;
}

async function onImportFileChange(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = ""; // 同じファイルを選び直しても change が発火するようにする
  if (!file) return;

  importResultMessage.value = "";
  try {
    const text = await file.text();
    const rows = parseCsvWithHeader(text);
    importRows.value = rows;
    importParseMessage.value = rows.length > 0
      ? `${rows.length}件のデータを読み込みました。内容を確認して「インポート実行」を押してください。`
      : "有効なデータ行が見つかりませんでした。ヘッダー行と列構成を確認してください。";
  } catch (e) {
    console.error(e);
    importRows.value = [];
    importParseMessage.value = "ファイルの読み込みに失敗しました。";
  }
}

async function runCsvImport() {
  if (importRows.value.length === 0) return;

  // この住戸リストに存在しないDetailIDが指定されている行がないか、実行前にまとめて検証する
  // （誤って別の子カードのDetailIDを含むCSVを取り込み、他の住戸を上書きしてしまう事故を防ぐ）
  const existingIds = new Set(houses.value.map(h => h.DetailID));
  const invalidRow = importRows.value.find(row => row.DetailID && !existingIds.has(Number(row.DetailID)));
  if (invalidRow) {
    importResultOk.value = false;
    importResultMessage.value = `DetailID "${invalidRow.DetailID}" はこの住戸リストに存在しません。エクスポートしたCSVを元に編集してからインポートしてください。`;
    return;
  }

  if (!confirm(`${importRows.value.length}件をインポートします。DetailID列が空欄の行は新規追加、指定された行は上書き更新されます。よろしいですか？`)) return;

  importing.value = true;
  importedCount.value = 0;
  importResultMessage.value = "";
  try {
    for (const row of importRows.value) {
      const detailId = row.DetailID ? Number(row.DetailID) : null;
      // upsertDetailは全項目を丸ごと上書きするAPIのため、CSVに含まれない項目
      // （VisitStatusや訪問履歴に紐づく集計項目など）を消してしまわないよう、
      // 既存レコードをベースにCSVの値を重ねる（#99の一括編集と同じ方式）
      const existing = detailId ? houses.value.find(h => h.DetailID === detailId) : null;
      const payload = existing ? { ...existing } : { DetailID: null };

      payload.CardNo  = props.cardNo;
      payload.ChildNo = props.childNo;
      for (const col of CSV_COLUMNS) {
        if (col === "DetailID" || col === "HousingNo" || col === "BuildingSW") continue;
        payload[col] = row[col] ?? "";
      }
      payload.BuildingNo = row.BuildingNo ? Number(row.BuildingNo) : null;

      const res = await upsertDetail(payload);
      if (res.status !== "success") {
        throw new Error(res.message || `${importedCount.value + 1}行目でエラーが発生しました`);
      }
      importedCount.value++;
    }

    importResultOk.value = true;
    importResultMessage.value = `インポートが完了しました。（${importedCount.value}件）`;
    importRows.value = [];
    await fetchHouses();
  } catch (e) {
    console.error(e);
    importResultOk.value = false;
    importResultMessage.value = e.message || `インポートに失敗しました（${importedCount.value}件まで完了）。`;
  } finally {
    importing.value = false;
  }
}

async function deleteRow(h) {
  if (!confirm(`住戸ID: ${h.DetailID} ${h.FamilyName || "（表札名なし）"} を削除しますか？`)) return;
  busy.value = true;
  try {
    await deleteDetail(h.DetailID);
    await fetchHouses();
  } catch (e) {
    console.error(e);
    alert("削除に失敗しました");
  } finally {
    busy.value = false;
  }
}

async function moveRow(h, direction) {
  busy.value = true;
  try {
    await moveDetailRow(h.DetailID, direction);
    await fetchHouses();
  } catch (e) {
    console.error(e);
  } finally {
    busy.value = false;
  }
}

async function renumberIds() {
  if (!confirm("住戸IDを現在の表示順で振り直します。よろしいですか？")) return;
  busy.value = true;
  try {
    await renumberDetailList(props.cardNo, props.childNo);
    await fetchHouses();
  } catch (e) {
    console.error(e);
  } finally {
    busy.value = false;
  }
}

// ---- 町名マスタ（kiban_master）由来の住所カスケード選択肢 ----
const townOptions = ref([]);
let townsLoaded = false;
const choOptions    = ref([]);
const banchiOptions = ref([]);

async function ensureTownsLoaded() {
  if (townsLoaded) return;
  townsLoaded = true;
  try {
    const res = await getKibanTowns();
    if (res.status === "success") townOptions.value = res.towns || [];
  } catch (e) {
    console.error("町名一覧の取得に失敗しました:", e);
  }
}

async function loadChoOptions(town) {
  choOptions.value = [];
  if (!town) return;
  try {
    const res = await getKibanChoList(town);
    if (res.status === "success") choOptions.value = res.choList || [];
  } catch (e) {
    console.error("番地一覧の取得に失敗しました:", e);
  }
}

async function loadBanchiOptions(town, cho) {
  banchiOptions.value = [];
  if (!town) return;
  try {
    const res = await getKibanBanchiList(town, cho);
    if (res.status === "success") banchiOptions.value = res.banchiList || [];
  } catch (e) {
    console.error("号一覧の取得に失敗しました:", e);
  }
}

async function onTownChange() {
  editForm.value.CSVCho    = "";
  editForm.value.CSVBanchi = "";
  await loadChoOptions(editForm.value.CSVTownName);
}
async function onChoChange() {
  editForm.value.CSVBanchi = "";
  await loadBanchiOptions(editForm.value.CSVTownName, editForm.value.CSVCho);
}
function onBanchiChange() {
  const b = banchiOptions.value.find(b => b.Banchi === editForm.value.CSVBanchi);
  if (b) {
    if (b.Lat != null) editForm.value.CSVLat = b.Lat;
    if (b.Lng != null) editForm.value.CSVLng = b.Lng;
  }
}

// ---- 建物マスタ（building_master）から選択 ----
const buildingMasterOptions = ref([]);
let buildingMasterLoaded = false;

async function ensureBuildingMasterLoaded() {
  if (buildingMasterLoaded) return;
  buildingMasterLoaded = true;
  try {
    const res = await searchBuildingMaster("");
    if (res.status === "success") buildingMasterOptions.value = res.buildings || [];
  } catch (e) {
    console.error("建物マスタの取得に失敗しました:", e);
  }
}

function onBuildingMasterChange() {
  const b = buildingMasterOptions.value.find(b => b.BuildingNo === editForm.value.BuildingNo);
  if (b) {
    editForm.value.BuildingCategory = b.BuildingCategory;
    editForm.value.BuildingName     = b.BuildingName;
    editForm.value.Floors           = b.Floors;
    editForm.value.Rooms            = b.Rooms;
  }
}

// NGFlagが「可」→「不可」に変わった時点（新規のNG登録）に、記録日・記録者を自動セットする
function onNgFlagChange() {
  if (editForm.value.NGFlag === "不可") {
    if (!editForm.value.NGDate) editForm.value.NGDate = new Date().toISOString().slice(0, 10);
    editForm.value.NGSarvant = authStore.userName;
    editForm.value.NGChecked = "未確認";
  }
}

// クリップボードから「緯度, 経度」形式の文字列を読み取り緯度経度欄に反映する
// （Googleマップアプリで地点を長押しコピーした際の書式。前後の括弧は許容する）
async function pasteClipboard() {
  try {
    const text = (await navigator.clipboard.readText() || "").trim();
    const cleaned = text.replace(/^\(/, "").replace(/\)$/, "").trim();
    const commaIdx = cleaned.search(/,/);
    if (commaIdx !== -1) {
      editForm.value.CSVLat = cleaned.slice(0, commaIdx).trim();
      editForm.value.CSVLng = cleaned.slice(commaIdx + 1).trim();
    } else if (cleaned) {
      editForm.value.CSVLat = cleaned;
    }
  } catch (e) {
    alert("クリップボードから読み取れませんでした：" + e.message);
  }
}

// ---- 地図で地点を指定 ----
const showMapPicker = ref(false);
const pickerMapContainer = ref(null);
let pickerMapInstance = null;
let pickerMarker = null;

async function openMapPicker() {
  showMapPicker.value = true;
  await nextTick();
  try {
    await loadGoogleMaps();
    const center = await resolveMapCenter(editForm.value, banchiOptions.value);
    pickerMapInstance = createMap(pickerMapContainer.value, center, 17);
    pickerMarker = addMarker(pickerMapInstance, center, "");
    pickerMapInstance.addListener("click", (e) => {
      pickerMarker.setPosition(e.latLng);
    });
  } catch (e) {
    console.error("地図の初期化に失敗しました:", e);
  }
}

// ピン確定地点に最も近い町名マスタの住所を自動セットする（#97）
async function confirmMapPicker() {
  if (pickerMarker) {
    const pos = pickerMarker.getPosition();
    editForm.value.CSVLat = pos.lat();
    editForm.value.CSVLng = pos.lng();
    try {
      const res = await getKibanNearest(pos.lat(), pos.lng());
      if (res.status === "success" && res.nearest) {
        editForm.value.AddressSW   = "リストから選択";
        editForm.value.CSVTownName = res.nearest.Town;
        editForm.value.CSVCho      = res.nearest.Cho;
        editForm.value.CSVBanchi   = res.nearest.Banchi;
        await loadChoOptions(editForm.value.CSVTownName);
        await loadBanchiOptions(editForm.value.CSVTownName, editForm.value.CSVCho);
      }
    } catch (e) {
      console.error("最寄り住所の取得に失敗しました:", e);
    }
  }
  closeMapPicker();
}

function closeMapPicker() {
  showMapPicker.value = false;
  pickerMapInstance = null;
  pickerMarker = null;
}

onMounted(fetchHouses);
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255,255,255,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.modal-backdrop-custom {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1040;
}

.modal {
  z-index: 1050;
}

.building-row {
  background-color: #f1f3f5;
}

.modal-content {
  position: relative;
}
.map-picker-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.98);
  z-index: 20;
  padding: 12px;
  display: flex;
  flex-direction: column;
}
.picker-map {
  flex: 1;
  min-height: 260px;
}
</style>
