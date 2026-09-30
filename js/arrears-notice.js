// 고객관리(연체) 탭 전환 · 미납안내문 생성 — index.html 안에 있던 스크립트를 그대로 옮김
  // ===== [신규] 고객관리(연체) 소버튼 전환: 연체 현황 / 미납안내 =====
  function showArrTab(btn){
    var target = btn.getAttribute('data-arr-tab');
    document.querySelectorAll('#page-arrears .subnav-btn').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    document.querySelectorAll('#page-arrears .arr-tab').forEach(function(t){ t.classList.remove('active'); });
    document.getElementById(target).classList.add('active');
    if (target === 'arr-tab-notice'){ ntFitPreview(); ntPingServer(); }
  }

  // ===== [신규] 미납안내문 생성 =====
  // 흐름: 미납내역 엑셀 업로드 -> 연체 1·2개월 고객 추출 -> 미리보기 -> 폴더 선택 -> 고객별 PDF 저장
  // 보안: 미납내역(고객명·이메일·금액)은 localStorage에 저장하지 않음. 모든 처리는 브라우저 안에서만 이뤄짐.
  var NP_W = 794, NP_H = 1123;          // 안내문 1장 크기 (A4 세로, 96dpi 기준 px)
  var NT_LOGO_SYM = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGgAAABoCAIAAACSfiL2AAAlxklEQVR4nO1953NdR3bn6XDjywkPkSAIEgBBghSDLI4pUauZHY/WNfbulqrs7/5s/1H+4k+eKq9s7yylGY2CNWISKYkRRE7vAS+Hm0P3fuj3gMcAgCBAaby1p1gMF/f27f716XN+55zuS8Q5h/8vBxf8U3fgP6vQn+i9Qs3RT/3S7dV24J78VMDtJQy4HzKPMY9xn/FA/ALGOGcAvGeQiIO4gAERBAQhCWMZi9+xTDBFb2pufmzgOlPMEYhZfmFcHMAIw4rlVh2v5Hg112v4QcsL2n5gBWHIOet9hnMBnIxRhJC4ROOylFHlPlXuU5WcrmQUhezcjbaf6f779WH9sYFDz/wBjIPDQicM7ICZITOCsOX7ddcvW17ZccuuX3O9hu8L4OyABZyz3uZ6gcM0LpGELKVVOafKeVXJ60qfrqRkKU5olJKIRFWCJYwRQM8ifU35kYF73sq4wNZte7FlLbXM5ba9YTpbjtvwAyvkDmM+5z4XS5WFHEIucOppCTgAIEAIAYGAYkQRkjCWMFIw0glOSGRQV8aj+mQyciYVH43qaVnu9oG90KEDKOCPDBwCzpwwNHzWDMKG75dcd6ltLbSspZa1YlhF06k4nh8yQAgQAEaAEHAAYapQz9D4c832XOUAjAEIZUR5TV6M2iu2U7C9k7HISETr05SUTCKUEPT6JhD9yDzO52zVsL+vth822k+a7VXTqXtBO+AWY24YumHoM8aFGsG2URI9Rc8C19ttDi95pHNRIkilRCc4glG/Ip2K6zOp2J/3Z86l4xFCe5s7kMn7kTTOCsO2F1Q9b9N2n7ZMAdxc09i0XWAACAPGgIVOiZXXi5mQzqj4S83T9gNd3USAxML2Gfe9oM0YBMEiweuWs2V7FoOmH45H9bym6JTQg7uJI9M4vr1M4Lm5QyHAbMv4dqv2fa31oGGsWm4rYEYYWkHgh923o8O4uFfpHwfOASEF4yglaZmciGgfDGY/GMidjGtpSQYEwDkHLszCvr05eo3bXjBBGJpBUPWDNcv7oda8Xarfr7eeNE3HC4AQwLhjxX4cQUgg4jLuun7VsjcMhwEwwC0/Ph2PplRJxQgh9Ip6dCQax2HHy3GEOqao4rhPm8ZXW/X/2GosmU7V99t+YAcB42JW37CK7SoIOAfOMEIJQvpU5b3+9H8byc2kY6O6KmMC0NHNzs27yFFqHAIAhELGWj4rOe6TpvF9rfXlZu1muWn4IRAEgOAgs/omRHSSI8wA6o5Xd3yMkUyxx5mCcL+mSK/mao8CON7pjOiVEbLblfrNUuNWtfm4aVRdzwYOROgX74RJzw9FtHMEfXm1zgISJpkSAFgx7H9d3Wr7QZxKFOOsTGWCO33dvZ3XBu7ZZhEAIDMMKo73pGl8Xqz+sdR42DSqtgMIAaWABR87UnB623uWFu815E7cwIX6AwfLDyzPvyPRIV1FwC+m43lN3benBwOu2xjrAod74801w/nt2uYfS/VHLWvD9swgBEK7xuKZ4Pyljb4oCDAAcMQBBLnouZ33kDXW06tt0gfo5dRFuCPhxDkC4MJNrZnOv65ump7fp8p5TQVAiO/aZTjkUu1yLd7wg3XDuVGq/75Y/bbSKvkBY7zDznoGexjp4CbIMUIUYwkjlVAZYwVhCWOKgWCgCFFABGMsYg7OGUAIEHIecAg4DzkPGPMBAgY+434Yuoz7jBme/9D1opRcyCayqtqnShreK1l5MODEtHOEOCAsAh0EPsCjuvG/los3ys15064GjAECchSQIQbQxYwj4BwYB84pIWmZ9Klyv67kNTmnSBlFTipSTKYRQlWCKMYAHWbGAUIAj3M3ZJYftn2v5QUNP6h7Yc3xKo5Xst2y4zY4gyBcMuwvN+sSwu/mk8ejkT26djjngHjF9eYN+8ut2uebtYcN0+Jd24EQHJroiGkCxglGmkyiVIoSHKc4I0t9mpzXlH5NyWtyTpUyipxQ5LhEdUJUgjFGgu0IshUC+Iy7IbODsO35Lc9veEHdC2uuV3H8ku2WHLfkuFXP1wlxfH/TtM0gtnffDmjjtmNtDoAgBP59rfWb5c3bleaC6TiCdiMQa+QwsCGBGuswfpXgyYh2JhmdSkZPxPV+TUnKJCLWKcYSxhLGBCOKEEGAe4IQYSUJgIS5inGMkrQkhToPGPc59xn3GfcYcxirut6m49Rst2m5MYLwm4kcECDe8Lwlw/pjqf7VZn3esJwjTIZzzjlgjCIySUhKRpaGI8rZRPRsMjqZio7F9YwsoVesliCATmEFEUCAQNnlOQZQ9bxN015rGgShCCWHpyM7qoO66DBA39da/3t185tKa93xXN7tnTBK6MUQfR9B25EuAmAcwlBVpam4+lY6/nYufToZ61PkOCVRiSgUvzzmeElCYPvq/vOJAZJU0qNkSFMBuEop41yEaS8lxPsD9xzwHMAKgi3Xu11pfLlVm2vbzeBo2BmHjlWLyjQtqydj+tuZ2MVs4nI2fSKqv3D3i8mnl6biuy3v9SMOwBEgCSMJk4hEXBZuWY4TsIyqpBX5pb3dCzjezUwLoya4kc/YYsu8U2ndKDdnDafth1y47Y7rOzCG3XQQAAAwTjhMRLS/GMldziQmYnq/rsQl6SU0/oXAaJdAaVc0e96+3WnOARzGN0zn5mal4flX8umMmt65u2cGDmDjhMFv+sH9evvzYuVBvV33w8O7zu3WMUYZTTkRUa/2JX85kJlJxXOKLPDgwIFz1Ktgb0SQEfjLbedRo32r3HDDcDwR3e3WvYBDXSqEAADxgHGfQcFyblebn29Vy64PCAHejkJfE0EuMuOM6QS9k038z+P9b6Vix3Q1KUvbNpWDyAywZ9PnRyUiHYIBoOYEXxQrtyv11baVViQn5B1VF/rRo9WvrnHIDcMV075XbT5otFctBxggifJXSiXs3W1OEOR1ZTKuv59PX+vPjEVUAtDlJHsGPkckCCDk3A7ZkmHdqTTuVJqmHxJMPLbrI3sCx7tmExAAmAH7plT7pFBeMGzAVHA5dPh4KgwUQq7kEv/92MDFdKxfkYgIMzu6vpOF4m8gTdwpNSAwPH/JsL+vtR60zGXTRQgPMVFXEyZiJ68jevBKGsc4Dzgv2e4PtdbdarPkBLuZ4gP2mmOEoop0Iqq+nY1f7UuNRFS5G6r9mDk7xmHTdm+WGzfK9VXLtYIQY/AY313h9gMOIYQAXBbWXX/RsOYNZ8PyXMYBExEfHLyT25kBDiGTZOlsKvJuX+JSJpHXZAkjDhwBf9ZpHqWWdWhMR3s677NCNtuyfrtRulVuNvwAMEYAjHUKbgDQLUTsyCtpnBWEC23zQaO9brt2wI5kIMLIxyk+k4y9m89MxCNR2kkf7k3Zj1gQlB1/ttW+VW78UGsXTQcIxhhTDrvw7I7sDVznwZbv36k2b1aaZdeHPZMtr9DRjuFEHEmY9yv0bCp2OZtOyxQ4B/TGQUPdRPT2/DxqtH+ztHGz0qy4oVhJGIGCkUox7ca9nO/EQmIxvFLkUPeCJ03zccNoeUdk3YBLhORkciKqjkW1AU0BANjLpBy5IEDQ8oMNy71VqX9drs+3LJOJEItjBBrFEUrk3bVkT+AQAIAPvOL5K4a9bjou44ct6HHBMUChcDIROZdO5NVOTMMRhudc15sQvkPHHjXavy+Uviw1VizXDBjDWLweIxQlNEmp0gUOiX73GLp9NM5jrOb7m7ZbdnzbC4DgoxkT5zLBIxHtVDySlqUjaPDVBSHgvB0ERce7Wa7/YbP2uGk1/HBH2zkQwAmZZhRZp6+ncQCG7y+3jNW21Q7D7ZruobotssiMS4BzsjKkaTEqPaMGR0/Ueks4HQv3pNH+ulT//Wb1u4bVdgOGMIhcO0fAgSKSVuV8RIpKpNur57Mk+wBn+sGaYW+YtsXYEVm3znAooJhMk4qk7D6rRyjbcWHTCwqW88dS/bNi5YeGWXUDCDlQwbs4AADjFKM+VR6OanF5V3z2Ac4K2IblFhzPCxkcxTLtpnEYQlwiSKIYY/QmCIhw3uJ93dgHHMbu1VrfbNU+36rdq7XbfgiAgAAA6ySpOAfOZASDmjoW0ZPyy3NKsC9wDmMlxyu7nseO1OUh4AA+4x7j4RvbZ9a7ylzG6q6/YJhfbFb/Y6t+v9muOC4AQoTyF56KUjyoqyMRPUpfV+Ncxup+0PQCn3XyB4cVUYxlKADe8oK67bmqAvIbcKJ8u7oKALDluH/YKH9Tqt+ptRcMywxD4ej4TupZ+HVOMaQlMhhRByOq8pp0BMDn3A5DJ2Th0aoFRh7jBdNdatsjEa3/hfzu4UXYLC8MW0Gw6Xjf1Zq/K1a/rTSWLdf2Q8DoJQyBcZninEKPR9W8puiE7NI2wL7APZ/S6RbIDycIEHIC/rRtZhTpdDo22bnOAJDIBXfLaS+vI+zSVfEH3w5zQ4Cy592pNn5fqH5Xay2ZTs3zXQCgGDhC7Nl3MAYcIlSeSkXPphPZ/UjST3TOASGPsXXTeSQZT5vmZDwSl6hCDpWk3LZoIedWEDY9f8N25lrmjXLjD4XqomE7nUIA7uz4fHH6OUtK9Gw6fj4dzyiHAw6JhBxHiG/P6aFUbjunG/Cw4YbzLetmuZ6R8VuZ5KioyHSYFsCz+t7dO7Jdk+nQixeTKD7nT1rtW+XGd9XWD3Vzw3Iafujxnns48OfXkggNICPT8+n4hUwirUg9u+ReIj/VyRrEAXzGyq73Xa2pYO4w7nPIKlJUIhS9LKx7ZgzbZFnAx7yQWUHYCsKWHxQs9261cavSuF8zFtoOhCFQ2kmQvXTOOQCATEhGlU7F9JOxyKCuYoC9yyn72rju5OKjOTDHRf6DYwAAgn2Ax02z7HrrlrfSct7uS7yVjaekXdnTS9eyw2HT9p42jScN40G9Pd8yi65XDULDCwEDIAIYdvIuL8LBOXCeiShXMvF3cskBtVOz5odIKwEGIAiRN3IiCgECBrztB20/9EOwPNYM/Krvj+haXKIaITJGFCGMAAPCnX0VKOA85EwcHHEZb/lhxfM2TGe20Z5tmo8arRXDZhxA7FdCCKFn1vPL+gEUw4iuXulLXcwkXjF23gc4ikDGSMIIg0j7HDrp34kdt1WZA6YAUPaCO43WU9O8XqgMaspoVO3X1ZyqpCQaoVhGiCDgwF0OdsBbQVD3/Irtbdlu2fHKnt/wAiMIrZAZoc8Ihm4NHnqKBd3DED01OQ6AkIR5muLTce1nudRMKqZTAsCAI7TnYPcBTiEoJdOERCV05IFR11wjxAFcxlw3qFpsicMThY5E1Lym5jQlKdEoxQpCGHEG4DGwQ9YKwprnV2y3ZLk1zzf8ABgHhABjINBNRuxm0nq7wAGgT5PPJSKXMomTsUhclgCAA9t3oPsAp1E8qMv9ujxvOsDxi8TucLKduuj6SkIAwOawYntFN5BbFsWI7myw4Qwg5CjgPGDcY8wPmc8BMAHc4wF7srXw3N92/oUAAbAQY3Q6Ef0fYwPvZFMJSeregfetfe8DXITSY1Ft2LDVGn5jFc6egggCAGAc7CC0edABlr9wW2dYqAM3PhgB5OIdGOKKNBpR3s4mr+TS47GIchBTvg9wCUkaj0eXDEcnNWAhIIxe3DZ+5LKdaH2+tPTCfQefyM7kBz4i+Gwm/heD2ff60iOaqhIEwBlwJDLR+6ncPsCphPRr6khEyymSQpF/+HDr1eUNHW5mDDCKK9Kgrl7JJd/vz5yOR5MSha7PekXZc7cS5wTjuCQN6tpxXV3S5JIfOoz35mv/kwnnEASSRGcy8ff60tcG0mdS0aQkCfeOACFAHG173L1Uer+QC4AilFPkM8nopuM4TdOxvf+EwPUcQ1Ll0Zh2tS/1wWBmOhnNKfLzyYRXk/2rXACQlOmVvpQLvOD4pbYDCJDIxXMEPZvLDvzyH0kQAALOwA9VlV7OJd/Np97LZ2bS8TglXY61sxkJ7Ty1l7xSrBqh5FQi2grDe9XmmmGbQehzBPsQ8j8N6fhlrhCcVrVTcf2/9Gfey6enEtFO4kjshzq47AocB867e3UkjDOKPBGPXM7E6677qOFsOQwQ44QDcMR7Ehp/IiJUR5grFgAL+iP6Lwf7/jyfuphOHI/oOiXAgSPOkahCHzgOfyWNwwhhhPKacjmbcFnosWbLN13G2J8WWj3SOVMCMsZxRc6r+qVM/BeDmbezyRFdE/V5zroFmteSXYHbqSNyJPJeGqGXs+mkohgeq9r2qg1WCACHru2/CQk5cI4JysrkUjb+X4f6LqYTY1E1I8sS7sSqHHPEEWL49XbdvWo+jgNICKVkeTpB/jxvGX7wba0933bafhC+sM3zp5FumIEQ6JQmZDqoyxMx7Upf6ueD2ZPRiNKZYGHVeorUryUHPiHNOK+53rxh/3Zt6/+slZ62rYYfAAcgZLuk2/Ua233q3Q9yoNfxnufQdm7wWa7azbIwBpxByGVCTieil3LxS7nEhUzimK4mFUknGD2TLUbPbic78I6VA2eAMYKsqsRVxfIDLwiTqvS0bVddzwg5Z7up3iELPLuMZyeS5QgjXSJRKicpHVaV8+n427nE+WxiMhHFz9zd29ahlshBNW5nZhqeX3Scu7Xmf2zW71ab9+uG7QZAukctd+wG5h3geE8LB+kibB9E5D1FKXGYkAFnwEGTyalYZDoVu5RNnE3FhnU1J8sxmep0rxLfYeS1ag4cAEFSlpKypFOiIpKSaFKSlk2n6QdGyOwg7PnsymFzKt0sJO/+DgAII1AIiVIapSROyaCunE5EzyRjF3LJyWRUP5La+Z5yMI3r2tSdU4QuY20vKDnummk/ahp3yo2HDWOxbbXdAAC638gAQPi1bFz3Ec46Kss4cAYYRSU6oqtTSX0qGT2djI1G9ZwqJyUak2SNikryG9iQ0iOvWeXq+AAOCsaKKmdV+XhUG9LVFKUDqvJU1zZstxUEdshsFrqMe4wFIePP7bmCF4b2XOoNEEaIECRjKhOsIqJ2PzWVU6XRiD6V1CcT0alUrF9Vnz0oyV/D3h9IXsfG9Yxup2zOODgBawV+w/Mrrl+0vaW2sdQ2V01n3fJKtltzHC9g3WJD10U+k3Hj3QBouyAAmkRTqpJVlQFNHtKUoYgyHNUGNDWvqUmJ6gRHKIlQIj+zn6HHtb8xnXt957C31LxgpW0stc0101m3vS3LqThO2w9txl3GAwDGgXV2V+00hxAQ4ASBhJCCkEZQTJLSqtKnqv2aNKQrQxF1MKLlNSVKnl0rO7WX7ZzDnxZwryoB504Q2AFzWOgw5obcYswMwrbrm0FoBYEdMi9kAdthZBghipFKiEZJRCIRSiIy1QlWMVYxVhBWCFEIVgiWCd73BPObltcELggC13U9z+McCMGyLGua9ioPWmFoBaHlB07I3DAMGIcuMcWAKMYqIapENEp0iSh/wh+NfR3ggiBoNBqFQmFraysMQ03TBgYGxsbGJOm5Uu5L/BoHHnLOGA85Zxz15nREIVOUwBFGBL15TnEIOQBwnHPf99vt9uLi4sLCwurq6ubmZhAEkUhkZGTk9OnTo6Oj/f39ut7Z7cZ7DGK3xvkaxZVOba3ng0w/dVAMAAeiI77vl8vlx48ff/zxx59//nmj0TBNk3Muy3ImkxkfH3/33Xc/+uij8fFxcX/30N22vM6A997A8RPKAYBzHOfp06dff/31559/fv/+fUppJpNhjLVarXq9vrGxgTF+++23h4eHZVnuOcR2IEXjQSC+IQoYY0JID277NMIYC8OQMYYQopTiQx6d2k8OAJxhGLdu3frd7363sLAAAO++++4HH3zgOM7jx48fP368sLCwtLS0tLQ0Pj7e19enqirAzhEohMQxPfTMhw27srOHMmTNZtPzPM65pmmpVEpc5z37LLelew6wc92yLMMwPM9DCCWTyVjs5V9cEU29tMEDyQGAM01zfn7+8ePHlmVls9m33nrrww8/dF13dHR0ZGTk0aNH6XSac768vDw3NyfL8qlTp/L5/larVdrasmzL8zzf933fD8MwCALOOWOMUBqJRCK6HolEMMZbW1srKyumaYrBj46OptNpAPA8r16re5537NixoeGhVqtVKBSCIFAURZIkSqllWSsrK5VKxXVdSmkul8vn84qiCLvsum4ikThx4gSldHFxsVqtRiKRRCKRTCZlWd7c3FxdXeWcp1KpTCaTz+fFrB8ZcI7j1Gq1Vqulquro6OjJkycnJiYQQqOjo9euXbNt27Zty7IePnz429/+1rbtf/iHf/jrv/7rjY2N3/3u07W1tXq9Xq/X2622aZmO7Xi+FwSBrutjY2MjIyPJZJIxPj8/9/3339frdUJIf3//mTNnRkdHM5mM67o3vrlRrpT/9m//9qOPPpqbm/v3f/930zRzuZwsy0EQlMvl+/fvr62tCS+fyWRyuVwymYxEIrVarVAonD9//u///u9jsdi//Mu/3Lhx4/jx4zMzM2fOnEmlUp9++uk//dM/BUFw/vz5n/3sZx9++OHQ0NBRAuf7vm3bvu+rqppKpdLpdDKZBIBEIiFusCzr/v37tVrt3r17pVLp/fffP3fu3Ozsk7t3766trTUajXK5XK1WXddFCEmSpChKOpVqZTLlcnl5eblUKjUaDcMwRGvVavXmzZtzc3PHjx8HgD9+88disTg8PHzixImlpaUHDx6YpplOpxlj9Xq93W6bphmGoTBtlmWJ1gBgbW1tbm6u2Wy+//776XT63r17d+7ccRwnHo9HIpFKpfLgwYPbt2+HYVitVhVFeeedd44YOOgxK8+ZXrHuDMPgnCuKEovFKpXK7OzsH/7wh/n5+WKx6DiOLMu6rpumGYvFBgcHjx07dvz48f7+/nQ67TjOJ5988vDhw8nJyb/5m78R/X7y5MnHH398//59zvn23Nx/cP83v/kN55wQommaZVnlcnl+fj4Wi3344YcXL17UNE0YhHa7XSwWl5aWOOec80Kh8Nlnn6XT6VqtFo/Hk8mkJEmiY81mc2hoqFgsFgqFxcVFAfdRAkcIURSFEOL7vmEYtm0LS1wqlUql0ubmZrvdFj0WdndlZeXOnTvFYrFcLiOEVFWVZZlSKpBNp9P5fL6/vz8ej9dqNdM0m81mNBq9cuXK2bNnGWOyLP/bv/1bq9WqVCqEEFmWFUUpbZVu3rwZiURkWcYYh2HYaDQajYYsy1NTU9euXavX68vLy47j2LZtmqbjOISQWCzm+/6dO3d0XS8UCgCgKArGuFgsbmxsGIZx/PhxhNDq6mq5XC4Wi81mMxKJ0N2P1RwMOFVVhXoL21yv14Vdu3v37tdff/3ll1/6vn/27NkwDG3bDoJga2tLluVGo1Gr1XRdF33FGPu+X61WEUKmaW5sbGSzWd/3m80mAESj0WQymUqlBK+WZRkAhFeJxWJhGHqet7GxQQiRJEnX9Ugk4vu+ACKdTsuyfO/evY8//rhYLFqWhTHWNE2W5dHRUcdx5ufnhalJp9NBEDDGCoXCgwcPcrncxMSEqqr1et00zYWFhadPn548eXLbpx8WOE3Tjh8/Pj4+/vjx41Kp9N13312/ft2yrLt37964ceP27duqqg4NDUWjUWFr+vr6Tpw4USqVfN/HGHPOBc/inHueJzRCVVVN0wT5whibprm4uEgICcNwbW3N8zyMsaqq29EIxpgxVq1Wy+VyPB4XE0kpDcOwWCw+ffp0eXm5UCjMzc2J1XDs2LFcLpdIJFzX5Zy7rivWZr1eL5fLhUJhbW2Ncz44OMg5xxgbhjE7OzswMJDL5Y4MuGg0euHChXq93mq1FhYWPv7441u3bgVB0G632+02ABw7duzkyZOCHyiK8vOf//yjjz66f//+9evXi8WiYRiO4/i+L5Z8Mpns7+/P5/PCxqXTaVVVFxYW/vmf/zmTySCE1tfXBW/o6+vr7+/f2tpijE1OTh47duzOnTvXr1/3fT+Xy4VhWCqVTNP89NNPFxYWCCHT09O2bS8uLnYYDyGxWGxoaGhiYmJra+vGjRvVanVpaSkMw/X19Uaj4fv+9tLmnD98+DCVSs3MzAindATAaZo2NTXlum69Xg+CoNlsrqyshGGoKEo2mx0eHj579uzp06c9zxsZGYnFYufPnz937pwsy+vr65qmVSoVASjGWHAFTdMIIRhjXdenpqYIIbZt1+v1RqNBKWWMTU9PR6PR8fHxeDwuSZJlWZcuXTp//rwkSQsLC6qqHjt2TOhjo9HgnBeLxYGBAcFjROOZTEZQs4GBgaGhoWq1aprmo0ePJEkS9GBgYCCTyYyMjDDGGo2G4N6NRsO27b3ROABwiqKMjo7GYjFd1ycnJ5eXl7e2tjzP03V9fHz88uXLQ0NDmqaVSqU/+7M/s217eHgYAJLJ5KlTp2KxmIjMms2mUDqEkG3bYRhyznO53Pvvv//rX/96fX390aNHrVYLY5zP56enpzOZjOM4rVYrkUgwxt55552LFy/KsmwYhuu6Y2NjuVzul7/8pW3bT58+LRaLwgtdvXr117/+dRAElmWJKR8aGjp79qx448DAgHA++XxekqRLly5dvXqVcz43N7e4uDg3N5dIJPaN2A4AnFANXdcJIfl8fnV1VdgvVVXHxsbOnTun63qlUqnX65FIxHXdubk5SunW1lahUGi3267rKoqSz+eFU8YYp1IpTdNc1zUMg1La399vWZbQNSGEEEopQogxBgDC4SwsLDQaDaGDw8PDw8PDg4ODrVarXC5vbGwINjc2NjY5Odlut1dWVoIg0DQtkUgMDAy4rptOpxOJhCRJ6XQ6Fotls9mLFy/OzMwAwPDw8MjISF9fH6VUUNSjAW5bMplMJBIZGxvzfZ8xJgCNRqPCUpTL5cXFxdnZ2R9++GH7YhiGhJC+vr6xsTGEUL1ez+VyH3zwwbFjx7744otbt24ZhrG0tLSxsTE7O9toNBhj8/Pzd+7cSSQS+XxeluVSqSQosaqqnucBwPT0dCKRSCQStm0XCoXl5eXFxUXDMCKRSDwe13W9WCw+fPhQluXx8fFcLmfbdqvVmp+fn5ubm56ePnXq1KlTp4aHh7cxymazYvWIgO/ogZNlWZbleDz+3HXHcTzPazabhUJhfn6eUhqPxxVFURRFcCLGmG3bjuMIRUAIxWIxoUfVarVSqWxsbCwuLiKEstmsLMtCN+PxuOu6a2tra2tr0Wg0m83atu26bjweLxQKrutWKpX19fVisRiGoSRJhJBWq7WysiLyBZZlzc7OBkEgy7JlWfPz84IDC+B6XacY176QvT5wu4mIqAWbbzabExMTMzMzuVwuFospigIAlmXVarXl5eVHjx5tbGxMT09XKpUnT55Uq1VVVRljxWJxdXV1ZGRkZmZmfHxcRP7C/X377belUunSpUt/+Zd/+fjx4+vXrz958kT8dG5uznGcwcHBkZERsYQF0IlEYmZmZnFx8Ztvvrl9+/bs7Kwsy8LzDg8PT0xMRKO7fldvXzli4BhjQRA4jhMEASEkHo+nUinBtjDGlUqlXC5blmWapmVZN27cEOmQRqMhYiCRJjAMQ1AcEcAJRQiCQDwl1r5hGIQQkXT47rvvKKVnzpyZmZkJgqBWq1UqlVarlc/nJycnfd//4osv1tfXRWyradrExMT4+PgratZucsTHLhFCIo8IAIZhbG5uuq4bjUYTiYQIVDnn0Wg0l8s1m8179+7Nzs4KJxCPx4VDlCRpa2vrk08+UVWVc97X13flypVoNCpJEmPs66+/XllZabfbjUZjfHx8dHS0Xq+LUtHly5evXr1648aNhYWFWq0m4hyRjhbMrlAoIISuXbv2q1/9anp6+pAjfSPnVUWs6nmeYRgIIREViYBBZCgHBgYURTEMo1arCSaYyWS2H8QYi9wJAMiyLLiL4Ae+75umKXIhACCydYQQAIhEIiKPRCkVyBqGoev64ODg5OTk1tZWqVTinE9MTFy+fFk8eBj5kQ76irSKyG4rijI8PJzP5x3HaTQai4uLtVotl8v19fWJxMbY2Nhf/dVfTU1NxeNxSqnv+8vLy0EQUEovXLhw9erV77///pNPPhHcRVEUhJBIZK6vrycSienp6eXl5QcPHkxMTDSbTU3TTpw4sbm5KaxePp9PpVJkzw8VvIq8EeAE7YpGo/l8PpPJiKBS13URFRBCBB9MJpMiDhP8g1JKKRUBPKVUkiRZljnnpmm2Wi1BAycmJt577z2E0N27dwFAcP2BgQERnIs4pFar2bYtkuMizs9kMtlsNpFIRKNRseoPP8ajB04E8xjjgYGBc+fOHT9+XPA+zvni4mK5XBa0LplMvvvuu7Is12q1YrGoaZpINyUSiWq1ev369a+++kpEtalUijFmWVY0Gh0aGjp16lS9Xj99+nSr1Zqbm4tGoxcvXmy320+ePPnqq6+EYiKEJicnT58+nc1mBYsmhKiqqqrqIUsN23LEwAnHKqTdbm9ubhJC2u22oiiCqQwPDw8MDFBKh4eHp6endV2/du0aYyydTg8PD4+Ojg4NDQn2L0RV1VwuF4lEIpEIQmhmZiafz09NTf3iF78olUqEkEQiMTw8bJrmN998gxAS+aj+/v6JiYkLFy4kk0nGWH9//9TUlOM4IlQ4kpEe5d6RRqPx8OHDzz777B//8R9FJUwQYEmSRGHpypUrf/d3f3f27FmEkEiQCI5Sr9fFwhQ7K0QpR4hIYYrsKQCIbI9t29VqVcQPlFJN04IgqFQq7XZb+OjtWoxg6YIAtdttSmlfX99uBbADyVFqHKVUrKYLFy6oqiosvUjAiekRpabR0dHepwYGBgYGBg70olgs9uLgR0ZGdrtfRGYHesW+cpTACXepKMrIyEitVhNgCdSEuxgZGenv7z/CN/6EcpRLVbiFIAhE8RS6vGxb40TdgBzqf5n8U5Ej3h/Xq2XQA1znZV05wjf+VPJj/zeh/8/I/wX/d/N7+/XJNAAAAABJRU5ErkJggg==';   // 공문 머리 로고(심볼)
  var NT_LOGO_WORD = 'data:image/png;base64,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'; // 공문 하단 로고(워드마크)
  var NT_RAW = [];          // 헤더 아래 원본 행
  var NT_COL = {};          // {name, custNo, email, overdue} 컬럼 위치
  var NT_MONTH_COLS = [];   // [{idx, month}] 시트에 나온 순서 그대로
  var NT_ROWS = [];         // 생성 대상 [{name, custNo, email, n, items:[{label, amount}], fileName}]
  var NT_SEL = -1;
  var ntYearTouched = false;
  var NT_PDFS = [];                                   // 이번에 생성한 PDF (발송용, 메모리에만 보관)
  var NT_SEND_URL = 'http://127.0.0.1:8765';          // PC에서 실행하는 "발송도우미"(파이썬) 주소

  function ntNum(v){
    if (v === null || v === undefined || v === '') return null;
    var n = Number(String(v).replace(/,/g,''));
    return isNaN(n) ? null : n;
  }
  function ntFmtAmt(v){ var n = ntNum(v); return n === null ? '-' : Math.round(n).toLocaleString('ko-KR'); }
  function ntFmtDate(iso){
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? (Number(m[1])+'. '+Number(m[2])+'. '+Number(m[3])+'.') : '';
  }
  function ntTodayIso(){
    var d = new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  // 기존 Python(extract_customer_number)과 동일: 12자리 숫자 우선, 없으면 숫자만
  function ntCustNo(raw){
    if (raw === null || raw === undefined) return '';
    var s = (typeof raw === 'number' && Number.isInteger(raw)) ? String(raw) : String(raw).trim();
    var m = s.match(/\d{12}/);
    return m ? m[0] : s.replace(/\D/g,'');
  }
  // 기존 Python(sanitize_filename)과 동일: 특수문자 -> '_', 공백 제거
  function ntSanitize(name){ return String(name).trim().replace(/[\/\\:*?"<>|,]/g,'_').replace(/\s+/g,''); }
  function ntCleanName(v){
    if (v === null || v === undefined) return '';
    var s = String(v).replace(/\u00A0/g,' ').trim();
    return s.toLowerCase() === 'nan' ? '' : s;
  }
  var NT_EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  function ntEmail(v){
    var s = (v === null || v === undefined) ? '' : String(v).trim();
    return NT_EMAIL_RE.test(s) ? s : '';
  }

  function ntHandleFile(evt){
    var file = evt.target.files[0];
    if (!file) return;
    var st = document.getElementById('nt-file-status');
    st.textContent = '처리 중...'; st.className = 'nt-status';
    var reader = new FileReader();
    reader.onload = function(e){
      try{
        var wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:null, raw:true});

        var h = -1;
        for (var i=0; i<Math.min(rows.length, 10); i++){
          if (rows[i] && rows[i].some(function(c){ return String(c||'').trim() === '연체개월'; })){ h = i; break; }
        }
        if (h === -1) throw new Error("'연체개월' 헤더를 찾을 수 없습니다");
        var header = rows[h].map(function(c){ return String(c===null?'':c).trim(); });
        NT_COL = { name:header.indexOf('고객명'), custNo:header.indexOf('고객번호'), overdue:header.indexOf('연체개월'), email:header.indexOf('이메일') };
        if (NT_COL.name === -1) throw new Error("'고객명' 컬럼이 없습니다");
        if (NT_COL.custNo === -1) throw new Error("'고객번호' 컬럼이 없습니다");

        NT_MONTH_COLS = [];
        header.forEach(function(c, idx){
          var p = arrParseMonthHeader(c);   // "7월" 또는 "26.7월" 모두 인식
          if (p) NT_MONTH_COLS.push({idx:idx, month:p.month, year:p.year});
        });
        if (!NT_MONTH_COLS.length) throw new Error("'3월' 같은 월 컬럼을 찾을 수 없습니다");

        NT_RAW = rows.slice(h+1);
        // 이메일 컬럼이 따로 없으면 값 패턴으로 찾아봄 (기존 발송 스크립트와 같은 방식)
        if (NT_COL.email === -1){
          for (var c=0; c<header.length; c++){
            var hit = NT_RAW.some(function(r){ return r && ntEmail(r[c]); });
            if (hit){ NT_COL.email = c; break; }
          }
        }
        ntFillMonthSelect();
        ntYearTouched = false;
        ntSetDefaultYear();
        ntRefreshAll();
        st.textContent = '반영완료'; st.className = 'nt-status ok';
      }catch(err){
        NT_RAW = []; NT_ROWS = []; NT_MONTH_COLS = []; ntFillMonthSelect(); ntRefreshAll();
        st.textContent = '오류: '+err.message; st.className = 'nt-status err';
      }
      evt.target.value = ''; // 같은 파일 재업로드 허용
    };
    reader.readAsArrayBuffer(file);
  }

  // 안내 시작월 선택지: 엑셀의 월 컬럼 순서 그대로.
  // 기본값은 "연체 1·2개월 고객에게 실제 금액이 들어있는 첫 월 컬럼"을 찾아서 자동 선택 (가장 많은 쪽 기준).
  function ntGuessStartIdx(){
    var votes = {};
    NT_RAW.forEach(function(row){
      if (!row) return;
      var ov = Number(String(row[NT_COL.overdue]===null||row[NT_COL.overdue]===undefined?'':row[NT_COL.overdue]).trim());
      if (!(ov === 1 || ov === 2)) return;
      for (var i=0; i<NT_MONTH_COLS.length; i++){
        var v = ntNum(row[NT_MONTH_COLS[i].idx]);
        if (v){ votes[i] = (votes[i]||0)+1; break; }
      }
    });
    var best = 0, bestN = -1;
    Object.keys(votes).forEach(function(k){ if (votes[k] > bestN){ bestN = votes[k]; best = Number(k); } });
    return best;
  }
  function ntFillMonthSelect(){
    var sel = document.getElementById('nt-start-month');
    sel.innerHTML = '';
    // 기본은 연도 입력칸 숨김 -> "26.7 월분부터". 연도 없는 옛 양식(7월)을 올렸을 때만 연도칸 표시
    var hasYear = NT_MONTH_COLS.some(function(mc){ return mc.year; });
    document.getElementById('nt-year-wrap').style.display = (NT_MONTH_COLS.length && !hasYear) ? 'contents' : 'none';
    if (!NT_MONTH_COLS.length){ sel.innerHTML = '<option value="">엑셀 업로드 후 선택</option>'; return; }
    NT_MONTH_COLS.forEach(function(mc, i){
      var o = document.createElement('option');
      o.value = i; o.textContent = (mc.year ? String(mc.year).slice(2)+'.' : '')+mc.month;
      sel.appendChild(o);
    });
    sel.value = String(NT_RAW.length ? ntGuessStartIdx() : 0);
  }
  function ntStartIdx(){
    var v = Number(document.getElementById('nt-start-month').value);
    return isNaN(v) ? 0 : v;
  }
  // 시작월이 기준일의 월보다 뒤면 전년도로 추정 (예: 기준일 2026-04-13, 시작월 2월 -> 2026년 / 시작월 11월 -> 2025년)
  function ntSetDefaultYear(){
    if (!NT_MONTH_COLS.length) return;
    var base = document.getElementById('nt-base-date').value || ntTodayIso();
    var by = Number(base.slice(0,4)), bm = Number(base.slice(5,7));
    var sc = NT_MONTH_COLS[ntStartIdx()];
    if (sc.year){ document.getElementById('nt-start-year').value = sc.year; return; } // 엑셀에 연도가 있으면 그대로 사용
    var sm = sc.month;
    document.getElementById('nt-start-year').value = (sm > bm) ? by-1 : by;
  }
  function ntOnBaseDateChange(){
    if (!ntYearTouched) ntSetDefaultYear();
    ntRefreshAll();
  }

  // 시작월부터 count개월치 "YYYY년 M월분" 라벨. 월이 거꾸로 넘어가면(1월 -> 12월) 연도를 하나 뺌
  function ntMonthLabels(count){
    var start = ntStartIdx();
    var y = Number(document.getElementById('nt-start-year').value) || new Date().getFullYear();
    var out = [];
    for (var k=0; k<count; k++){
      var cur = NT_MONTH_COLS[start+k];
      if (!cur) break;
      if (cur.year && !ntYearTouched) y = cur.year;                          // 엑셀에 연도가 있으면 그 연도 사용
      else if (k > 0 && cur.month > NT_MONTH_COLS[start+k-1].month) y--;
      out.push({label:y+'년 '+cur.month+'월분', idx:cur.idx});
    }
    return out;
  }

  function ntBuildTargets(){
    NT_ROWS = [];
    var excl = {over:0, noname:0, nomail:0};
    var used = {};
    var labels = ntMonthLabels(2);
    NT_RAW.forEach(function(row){
      if (!row) return;
      var ov = String(row[NT_COL.overdue]===null||row[NT_COL.overdue]===undefined ? '' : row[NT_COL.overdue]).trim();
      var ovNum = Number(ov);
      if (ov === '' || isNaN(ovNum) || ovNum < 1) return;          // 0개월·빈칸·헤더 반복행
      if (ovNum >= 3){ excl.over++; return; }                        // 3개월 이상은 별도 절차
      var n = ovNum; // 1 또는 2
      var name = ntCleanName(row[NT_COL.name]);
      if (!name){ excl.noname++; return; }
      var custNo = ntCustNo(row[NT_COL.custNo]);
      var email = (NT_COL.email >= 0) ? ntEmail(row[NT_COL.email]) : '';
      if (!email) excl.nomail++;
      var items = [], total = 0;
      for (var k=0; k<n; k++){
        if (!labels[k]) break;
        var amt = ntNum(row[labels[k].idx]);
        items.push({label:labels[k].label, amount:amt});
        total += amt || 0;
      }
      var base = ntSanitize(custNo ? name+'_'+custNo : name);
      var fileName = base+'.pdf';
      if (used[fileName]){ used[fileName]++; fileName = base+'('+used[fileName]+').pdf'; } else used[fileName] = 1;
      NT_ROWS.push({name:name, custNo:custNo, email:email, n:n, items:items, total:total, fileName:fileName});
    });
    NT_ROWS.sort(function(a,b){ return a.n - b.n || a.name.localeCompare(b.name,'ko'); });
    return excl;
  }

  function ntRefreshAll(){
    var hint = document.getElementById('nt-month-hint');
    if (NT_MONTH_COLS.length){
      var lb = ntMonthLabels(2).map(function(o){ return o.label; });
      hint.textContent = '시작월은 금액이 들어있는 월로 자동 선택됩니다. 현재 설정으로는 1개월 대상에 '+(lb[0]||'-')+', 2개월 대상에 '+lb.join(' · ')+'이 표시됩니다. 다르면 직접 고쳐주세요.';
    } else {
      hint.textContent = '엑셀을 올리면 월 컬럼을 읽어 목록을 채웁니다. 안내문에 표시할 첫 월을 고르세요(2개월 대상은 그 전월까지 표시).';
    }
    var excl = NT_RAW.length ? ntBuildTargets() : {over:0, noname:0, nomail:0};
    if (!NT_RAW.length) NT_ROWS = [];

    // 요약 칩
    var chips = document.getElementById('nt-chips');
    chips.innerHTML = '';
    if (NT_RAW.length){
      var c1 = NT_ROWS.filter(function(r){ return r.n===1; }).length, c2 = NT_ROWS.length - c1;
      var list = [['nt-chip m1','1개월 '+c1+'건'], ['nt-chip m2','2개월 '+c2+'건'], ['nt-chip','생성 합계 '+NT_ROWS.length+'건'],
                  ['nt-chip','제외: 3개월 이상 '+excl.over+'건 · 고객명 없음 '+excl.noname+'건']];
      if (excl.nomail) list.push(['nt-chip m2','이메일 없음 '+excl.nomail+'건 (안내문은 생성됨)']);
      list.forEach(function(p){
        var s = document.createElement('span'); s.className = p[0]; s.textContent = p[1]; chips.appendChild(s);
      });
    }

    // 대상 목록 (고객 데이터는 textContent로만 넣음)
    var body = document.getElementById('nt-list-body');
    body.innerHTML = '';
    if (!NT_ROWS.length){
      var tr0 = document.createElement('tr'); var td0 = document.createElement('td');
      td0.colSpan = 6; td0.className = 'nt-empty';
      td0.textContent = NT_RAW.length ? '연체 1·2개월 대상 고객이 없습니다' : '엑셀을 업로드하면 대상 고객이 표시됩니다';
      tr0.appendChild(td0); body.appendChild(tr0);
    }
    NT_ROWS.forEach(function(r, i){
      var tr = document.createElement('tr');
      [[r.name,'l'], [r.custNo,''], [r.email || '없음', r.email ? 'l' : 'no-mail'], [r.n+'개월',''],
       [Math.round(r.total).toLocaleString('ko-KR'),'r'], [r.fileName,'l']].forEach(function(c){
        var td = document.createElement('td'); td.textContent = c[0]; if (c[1]) td.className = c[1]; tr.appendChild(td);
      });
      tr.onclick = function(){ ntSelect(i); };
      body.appendChild(tr);
    });

    document.getElementById('nt-gen-btn').disabled = !NT_ROWS.length;
    ntSelect(NT_ROWS.length ? Math.min(Math.max(NT_SEL,0), NT_ROWS.length-1) : -1);
  }

  // ---- 안내문 양식 (Word 공문 양식 1개월/2개월을 HTML로 옮긴 것) ----
  function ntBuildNotice(rec){
    var page = document.createElement('div');
    page.className = 'np-page';
    var subject = (rec.n === 1) ? '열요금 미납 안내' : '열요금 장기 체납 안내 및 납부 독촉';
    var paras = (rec.n === 1)
      ? '<li>귀 사용자의 무궁한 발전을 기원합니다.</li>'+
        '<li>열요금 미납 현황을 아래와 같이 안내하오니 조속히 납부하시기 바랍니다. 아울러, 열공급규정 제63조(요금의 연체료)에 의거하여 열요금 연체료를 청구할 예정이오니 업무에 참고하시기 바랍니다.</li>'
      : '<li>귀 사용자의 무궁한 발전을 기원합니다.</li>'+
        '<li>현재 열요금 장기 체납 중으로 열공급규정 제24조에 의거 <span class="np-stop">"열공급 정지"</span> 사유에 해당합니다. 열요금 미납 현황을 안내하오니, 조속히 납부하시기 바랍니다.</li>'+
        '<li>아울러, 열공급 정지가 유예된 사용자는 열공급 정지 유예 확정 월부터 열공급규정 제63조에 따른 유예연체료를 매월 추가로 납부하여야 합니다.</li>';
    page.innerHTML =
      '<div class="np-lh"><img alt="" src="'+NT_LOGO_SYM+'">'+
        '<div class="np-lh-txt"><div class="np-lh-slogan">공존의 가치를 높이는 초우량 에너지기업</div>'+
        '<div class="np-lh-name">청라에너지주식회사</div></div></div>'+
      '<div class="np-rule"></div>'+
      '<div class="np-meta">'+
        '<div class="np-meta-row"><span class="np-lb"><i>수</i><i>신</i><i>자</i></span><span class="np-to"></span></div>'+
        '<div class="np-meta-row"><span class="np-lb"><i>(경</i><i>유)</i></span><span></span></div>'+
        '<div class="np-meta-row"><span class="np-lb"><i>제</i><i>목</i></span><span>'+subject+'</span></div>'+
      '</div>'+
      '<ol class="np-body">'+paras+'</ol>'+
      '<div class="np-sec">□ 미납 현황 (<span class="np-date"></span> 기준)</div>'+
      '<table class="np-table"><thead><tr><th style="width:30%;">구분</th><th style="width:40%;">미납금액(원)</th><th>비고</th></tr></thead><tbody></tbody></table>'+
      '<div class="np-sec">□ 납부계좌 안내</div>'+
      '<ul class="np-acct"><li>은 행 명 : 우리은행</li><li>계좌번호 : <b>1005-603-148101</b></li><li>예 금 주 : 청라에너지 ㈜.&nbsp;&nbsp;끝.</li></ul>'+
      '<div class="np-foot">'+
        '<div class="np-foot-logo"><img alt="청라에너지주식회사" src="'+NT_LOGO_WORD+'"></div>'+
        '<div class="np-foot-row"><span class="np-foot-l"><span>우</span><span>23450 인천광역시 검단구 원당대로 1045 금호헤리티지Ⅶ 9층</span></span><span>www.cndh.co.kr</span></div>'+
        '<div class="np-foot-row"><span class="np-foot-l"><span>전화</span><span>1522-2479</span><span>FAX</span><span>032-563-8869</span><span>/</span></span><span>cs@e-cheongna.co.kr</span></div>'+
      '</div>';
    page.querySelector('.np-to').textContent = rec.name;
    page.querySelector('.np-date').textContent = ntFmtDate(document.getElementById('nt-base-date').value);
    var tb = page.querySelector('.np-table tbody');
    rec.items.forEach(function(it){
      var tr = document.createElement('tr');
      [[it.label,''], [it.amount === null ? '' : ntFmtAmt(it.amount),'amt'], ['연체료 일할계산','']].forEach(function(c){
        var td = document.createElement('td'); td.textContent = c[0]; if (c[1]) td.className = c[1]; tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    return page;
  }

  function ntSelect(i){
    NT_SEL = i;
    var trs = document.querySelectorAll('#nt-list-body tr');
    trs.forEach(function(tr, k){ tr.classList.toggle('sel', k === i && NT_ROWS.length > 0); });
    var wrap = document.getElementById('nt-preview-wrap');
    var tag = document.getElementById('nt-preview-tag');
    wrap.querySelectorAll('.nt-preview-stage').forEach(function(s){ s.remove(); });
    document.getElementById('nt-preview-empty').style.display = (i < 0) ? '' : 'none';
    if (i < 0){ tag.textContent = '대상 미선택'; return; }
    var rec = NT_ROWS[i];
    tag.textContent = rec.n+'개월 양식 · '+rec.fileName;
    var stage = document.createElement('div');
    stage.className = 'nt-preview-stage';
    stage.appendChild(ntBuildNotice(rec));
    wrap.appendChild(stage);
    ntFitPreview();
  }

  // 미리보기는 A4 원본(794x1123px)을 패널 크기에 맞춰 축소해서 보여줌
  function ntFitPreview(){
    var wrap = document.getElementById('nt-preview-wrap');
    var stage = wrap.querySelector('.nt-preview-stage');
    if (!stage || !wrap.clientWidth) return;
    var s = Math.min((wrap.clientWidth-24)/NP_W, (wrap.clientHeight-24)/NP_H);
    if (s <= 0) return;
    stage.style.width = (NP_W*s)+'px';
    stage.style.height = (NP_H*s)+'px';
    stage.querySelector('.np-page').style.transform = 'scale('+s+')';
  }
  window.addEventListener('resize', ntFitPreview);

  // 미납안내 탭이 열려 있는 동안에는 발송도우미 상태를 주기적으로 다시 확인 (나중에 켜도 반영되도록)
  setInterval(function(){
    var tab = document.getElementById('arr-tab-notice');
    var page = document.getElementById('page-arrears');
    if (tab && page && tab.classList.contains('active') && page.classList.contains('active')) ntPingServer();
  }, 5000);

  function ntSetProgress(done, total, text, cls){
    document.getElementById('nt-progress-fill').style.width = (total ? done/total*100 : 0)+'%';
    var st = document.getElementById('nt-gen-status');
    st.textContent = text; st.className = 'nt-status' + (cls ? ' '+cls : '');
  }

  async function ntGenerate(){
    if (!NT_ROWS.length) return;
    var dir = null;
    // 폴더 선택 창은 반드시 클릭 직후에 열어야 함 (브라우저 보안 규칙)
    if (window.showDirectoryPicker){
      try{ dir = await window.showDirectoryPicker({mode:'readwrite'}); }
      catch(e){
        if (e && e.name === 'AbortError'){ ntSetProgress(0,0,'폴더 선택이 취소되었습니다'); return; }
        ntSetProgress(0,0,'폴더를 열 수 없습니다: '+e.message,'err'); return;
      }
    }
    if (!window.html2canvas || !window.jspdf || (!dir && !window.JSZip)){
      ntSetProgress(0,0,'PDF 라이브러리를 불러오지 못했습니다 (인터넷 연결 확인)','err'); return;
    }

    var btn = document.getElementById('nt-gen-btn');
    btn.disabled = true;
    var host = document.createElement('div');
    host.style.cssText = 'position:fixed; left:-20000px; top:0; width:'+NP_W+'px; height:'+NP_H+'px; pointer-events:none;';
    document.body.appendChild(host);
    var zip = dir ? null : new window.JSZip();
    var total = NT_ROWS.length, ok = 0, fails = [];
    NT_PDFS = [];
    ntUpdateSendBtn();

    try{
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      for (var i=0; i<total; i++){
        var rec = NT_ROWS[i];
        ntSetProgress(i, total, (i+1)+' / '+total+' 생성 중...');
        try{
          host.innerHTML = '';
          var page = ntBuildNotice(rec);
          host.appendChild(page);
          var imgs = page.querySelectorAll('img');
          for (var k=0; k<imgs.length; k++){ if (imgs[k].decode){ try{ await imgs[k].decode(); }catch(e){} } }
          var canvas = await window.html2canvas(page, {scale:2, backgroundColor:'#ffffff', logging:false});
          var pdf = new window.jspdf.jsPDF({orientation:'portrait', unit:'mm', format:'a4', compress:true});
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
          var blob = pdf.output('blob');
          if (dir){
            var fh = await dir.getFileHandle(rec.fileName, {create:true});
            var w = await fh.createWritable();
            await w.write(blob);
            await w.close();
          } else {
            zip.file(rec.fileName, blob);
          }
          NT_PDFS.push({fileName:rec.fileName, name:rec.name, email:rec.email, months:rec.n, pdf:await ntBlobToBase64(blob)});
          ok++;
        }catch(err){
          fails.push(rec.fileName);
          console.error('[미납안내문] '+rec.fileName, err);
        }
      }
      if (zip && ok){
        var zblob = await zip.generateAsync({type:'blob'});
        var a = document.createElement('a');
        a.href = URL.createObjectURL(zblob);
        a.download = '미납안내문_'+(document.getElementById('nt-base-date').value || ntTodayIso()).replace(/-/g,'')+'.zip';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){ URL.revokeObjectURL(a.href); }, 5000);
      }
      var where = dir ? '"'+dir.name+'" 폴더에' : 'ZIP으로';
      var msg = '완료: '+ok+'건 '+where+' 저장' + (fails.length ? ' · 실패 '+fails.length+'건 ('+fails.slice(0,3).join(', ')+(fails.length>3?' 외':'')+')' : '');
      ntSetProgress(total, total, msg, fails.length ? 'err' : 'ok');
    }finally{
      host.remove();
      btn.disabled = !NT_ROWS.length;
      ntUpdateSendBtn();
    }
  }

  // ===== [신규] 메일 발송: PC에서 실행 중인 "발송도우미"(파이썬 + Outlook)에 넘겨서 보냄 =====
  // 브라우저는 Outlook을 직접 조종할 수 없어서, 내 PC에서 도는 작은 프로그램에 발송을 맡기는 구조.
  // 고객 정보와 PDF는 내 PC 안에서만 오가고 외부로 나가지 않음.
  function ntBlobToBase64(blob){
    return new Promise(function(resolve, reject){
      var r = new FileReader();
      r.onload = function(){ resolve(String(r.result).split(',')[1]); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  function ntSendable(){ return NT_PDFS.filter(function(p){ return p.email; }); }

  function ntUpdateSendBtn(){
    var btn = document.getElementById('nt-send-btn');
    if (!btn) return;
    var n = ntSendable().length;
    btn.disabled = !n;
    btn.textContent = n ? ('Outlook으로 발송 ('+n+'건)') : 'Outlook으로 발송';
  }

  // 발송도우미가 켜져 있는지 확인
  function ntPingServer(){
    var badge = document.getElementById('nt-srv-badge');
    if (!badge) return;
    fetch(NT_SEND_URL+'/ping', {method:'GET'})
      .then(function(r){ return r.ok ? r.json() : Promise.reject(new Error('bad')); })
      .then(function(){
        window.NT_SRV_OK = true;
        badge.textContent = '발송도우미 연결됨';
        badge.style.background = '#E3F2EA'; badge.style.color = 'var(--good)'; badge.style.borderColor = '#E3F2EA';
        ntUpdateSendBtn();
      })
      .catch(function(){
        window.NT_SRV_OK = false;
        badge.textContent = '발송도우미 미실행 (클릭하면 다시 확인)';
        badge.style.background = '#FBEAE6'; badge.style.color = 'var(--bad)'; badge.style.borderColor = '#FBEAE6';
        ntUpdateSendBtn();
      });
  }

  async function ntSendMail(){
    var items = ntSendable();
    if (!items.length) return;
    var st0 = document.getElementById('nt-send-status');
    // 눌린 시점에 발송도우미가 살아있는지 한 번 더 확인 (창을 나중에 켰을 수도 있어서)
    try{
      var ping = await fetch(NT_SEND_URL+'/ping');
      if (!ping.ok) throw new Error('bad');
      await ping.json();
      ntPingServer();
    }catch(e){
      ntPingServer();
      st0.textContent = '발송도우미에 연결할 수 없습니다. 발송도우미.bat 창이 켜져 있는지 확인하세요.';
      st0.className = 'nt-status err';
      return;
    }
    var noMail = NT_PDFS.length - items.length;
    var msg = '아래 내용으로 메일을 발송합니다.\n\n'
            + '· 발송 대상: '+items.length+'건\n'
            + (noMail ? '· 이메일 없어 제외: '+noMail+'건\n' : '')
            + '\n발송은 취소할 수 없습니다. 진행할까요?';
    if (!confirm(msg)) return;

    var btn = document.getElementById('nt-send-btn');
    var fill = document.getElementById('nt-send-fill');
    var st = document.getElementById('nt-send-status');
    btn.disabled = true;
    fill.style.width = '30%';
    st.textContent = '발송도우미에 전달 중... (PC 화면의 확인창을 확인하세요)'; st.className = 'nt-status';

    try{
      var res = await fetch(NT_SEND_URL+'/send', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({items:items, noMail:noMail})
      });
      var data = await res.json();
      fill.style.width = '100%';
      if (data.cancelled){
        st.textContent = 'PC에서 발송이 취소되었습니다'; st.className = 'nt-status';
      } else if (data.error){
        st.textContent = '오류: '+data.error; st.className = 'nt-status err';
      } else {
        var failTxt = (data.failed && data.failed.length) ? (' · 실패 '+data.failed.length+'건') : '';
        st.textContent = '발송 완료: '+data.sent+'건'+failTxt;
        st.className = 'nt-status ' + ((data.failed && data.failed.length) ? 'err' : 'ok');
      }
    }catch(e){
      fill.style.width = '0%';
      st.textContent = '발송도우미에 연결할 수 없습니다. 발송도우미.bat이 실행 중인지 확인하세요.';
      st.className = 'nt-status err';
      window.NT_SRV_OK = false;
    }finally{
      ntUpdateSendBtn();
    }
  }

  (function ntInit(){
    document.getElementById('nt-base-date').value = ntTodayIso();
    ntPingServer();
  })();
